import type { Json } from '../db/database.types';
import { usageCostUsd, type ChatClient, type ModelInfo } from './ai';
import { TAGGABLE_CARD_COLUMNS, toTaggerCard } from './cardText';
import { fetchAll, loadComplexFrames, loadNameIndexFor, loadVocab, storeCardTags, type Db } from './db';
import { buildSystemPrompt, TAG_PROMPT_VERSION } from './prompt';
import { buildTagJsonSchema } from './tagJsonSchema';
import { tagCard, type TaggerConfig } from './tagger';

/**
 * The tagging pipeline the scheduled Workflow (src/workers/effect-tagger.ts) runs, split into small
 * idempotent pieces so each can be its own retryable Workflow step.
 */

export type RunKind = 'import' | 'vocab' | 'manual' | 'backfill';

export type RunPlan = { kind: RunKind; source: string | null; version: string | null; reason: string };

/** Runs stuck in 'running' longer than this are assumed dead (e.g. a Workflow that was terminated). */
export const STALE_RUN_MS = 6 * 60 * 60 * 1000;

/**
 * What, if anything, the next scheduled run should do:
 * - a newly uploaded Neuron import (latest `db_metadata` version per source not yet covered by a
 *   completed import run) -> 'import' (also refreshes archetypes);
 * - otherwise open re-tag requests (vocabulary changes) -> 'vocab';
 * - otherwise anything left in the queue (earlier failures) -> 'manual'.
 * Returns null while another run is in progress, or when there's nothing to do.
 */
export const detectWork = async (db: Db, now = Date.now()): Promise<RunPlan | null> => {
  const running = await db.from('effect_tag_runs').select('id,started_at').eq('status', 'running');
  if (running.error) throw new Error(running.error.message);
  for (const r of running.data) {
    if (now - Date.parse(r.started_at) < STALE_RUN_MS) return null;
    await db
      .from('effect_tag_runs')
      .update({ status: 'failed', error: 'stale: no progress for 6 hours', finished_at: new Date(now).toISOString() })
      .eq('id', r.id);
  }

  const [imports, done] = await Promise.all([
    db.from('db_metadata').select('source,version,created_at').eq('uploaded', true).order('created_at', { ascending: false }).limit(50),
    db.from('effect_tag_runs').select('source,version').eq('kind', 'import').eq('status', 'completed'),
  ]);
  if (imports.error) throw new Error(imports.error.message);
  if (done.error) throw new Error(done.error.message);
  const covered = new Set(done.data.map((r) => `${r.source}\u0000${r.version}`));
  const latestPerSource = new Map<string, { source: string; version: string }>();
  for (const row of imports.data) if (!latestPerSource.has(row.source)) latestPerSource.set(row.source, row);
  const pending = [...latestPerSource.values()].find((r) => !covered.has(`${r.source}\u0000${r.version}`));
  if (pending) return { kind: 'import', source: pending.source, version: pending.version, reason: `new import ${pending.source} ${pending.version}` };

  const retag = await db.from('effect_card_tags').select('card_id', { count: 'exact', head: true }).not('retag_reason', 'is', null);
  if (retag.error) throw new Error(retag.error.message);
  if (retag.count) return { kind: 'vocab', source: null, version: null, reason: `${retag.count} re-tag requests` };

  const queued = await db.from('effect_tag_queue').select('card_id', { count: 'exact', head: true });
  if (queued.error) throw new Error(queued.error.message);
  if (queued.count) return { kind: 'manual', source: null, version: null, reason: `${queued.count} cards left in the queue` };
  return null;
};

export const startRun = async (db: Db, plan: RunPlan, model: string, workflowInstanceId: string | null): Promise<number> => {
  const { data, error } = await db
    .from('effect_tag_runs')
    .insert({
      kind: plan.kind,
      source: plan.source,
      version: plan.version,
      model,
      prompt_version: TAG_PROMPT_VERSION,
      workflow_instance_id: workflowInstanceId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
};

/** Import-time upkeep: rebuild archetype memberships and drop tags of cards that no longer exist. */
export const refreshDerivedData = async (db: Db): Promise<{ archetypeRows: number; orphansDeleted: number }> => {
  const archetypes = await db.rpc('refresh_card_archetypes');
  if (archetypes.error) throw new Error(archetypes.error.message);
  const orphans = await db.rpc('effect_delete_orphan_tags');
  if (orphans.error) throw new Error(orphans.error.message);
  return { archetypeRows: archetypes.data, orphansDeleted: orphans.data };
};

export type QueueItem = { card_id: number; text_hash: string | null };

export const loadQueue = async (db: Db): Promise<QueueItem[]> =>
  (await fetchAll((from, to) => db.from('effect_tag_queue').select('card_id,text_hash').order('card_id').range(from, to))).filter(
    (q): q is QueueItem => q.card_id !== null,
  );

export type BatchResult = { stored: number; drafted: number; failed: { card_id: number; error: string }[]; costUsd: number };

/** Everything `tagCard` needs from the live vocabulary (built once per step). */
export const buildTaggerConfig = async (db: Db, client: ChatClient, model: ModelInfo): Promise<TaggerConfig> => {
  const { prompt, vocab } = await loadVocab(db);
  return {
    client,
    model: model.id,
    systemPrompt: buildSystemPrompt(prompt),
    jsonSchema: buildTagJsonSchema(vocab),
    vocab,
    reasoningEffort: model.reasoning ? model.reasoning[0] : undefined,
    maxAttempts: 3,
  };
};

/** Tags and stores a batch of queued cards, `concurrency` at a time. Never throws for a single card. */
export const tagBatch = async (db: Db, cfg: TaggerConfig, model: ModelInfo, items: QueueItem[], concurrency = 5): Promise<BatchResult> => {
  const result: BatchResult = { stored: 0, drafted: 0, failed: [], costUsd: 0 };
  const ids = items.map((i) => i.card_id);
  const [cards, frames, relations] = await Promise.all([
    db.from('neuron_cards').select(TAGGABLE_CARD_COLUMNS).eq('language', 'en').in('id', ids),
    loadComplexFrames(db),
    db.from('neuron_card_relations').select('card_id,relation_card_id').in('card_id', ids),
  ]);
  if (cards.error) throw new Error(cards.error.message);
  if (relations.error) throw new Error(relations.error.message);
  const related = new Map<number, Set<number>>();
  for (const r of relations.data) related.set(r.card_id, (related.get(r.card_id) ?? new Set()).add(r.relation_card_id));

  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      const card = cards.data.find((c) => c.id === item.card_id);
      if (!card) {
        result.failed.push({ card_id: item.card_id, error: 'card not found' });
        continue;
      }
      const res = await tagCard(toTaggerCard(card, frames.names), cfg);
      result.costUsd += usageCostUsd(model, res.usage);
      if (!res.ok) {
        result.failed.push({ card_id: item.card_id, error: res.error.slice(0, 500) });
        continue;
      }
      try {
        const outcome = await storeCardTags(db, {
          cardId: item.card_id,
          textHash: item.text_hash ?? undefined,
          output: res.output,
          names: await loadNameIndexFor(db, res.output),
          relatedIds: related.get(item.card_id),
          model: cfg.model,
          promptVersion: TAG_PROMPT_VERSION,
          mode: 'tagger',
        });
        if (outcome === 'drafted') result.drafted++;
        else result.stored++;
      } catch (e) {
        result.failed.push({ card_id: item.card_id, error: (e as Error).message.slice(0, 500) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
};

export const updateRunProgress = async (db: Db, runId: number, progress: { total?: number; done: number; failed: number }) => {
  const { error } = await db
    .from('effect_tag_runs')
    .update({ ...(progress.total !== undefined ? { cards_total: progress.total } : {}), cards_done: progress.done, cards_failed: progress.failed })
    .eq('id', runId);
  if (error) throw new Error(error.message);
};

export const finishRun = async (db: Db, runId: number, status: 'completed' | 'failed', error: string | null) => {
  const res = await db.from('effect_tag_runs').update({ status, error, finished_at: new Date().toISOString() }).eq('id', runId);
  if (res.error) throw new Error(res.error.message);
};

// ---------------------------------------------------------------------------
// Suggestion clustering
// ---------------------------------------------------------------------------

type SuggestionRow = { id: number; kind: 'verb' | 'zone'; proposed_term: string; description: string | null; phrases: string[] };

const CLUSTER_SCHEMA = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'integer' }, cluster: { type: 'string' } }, required: ['id', 'cluster'] },
    },
  },
  required: ['assignments'],
};

/** Pure: the clustering prompt for one chunk (exported for tests). */
export const buildClusterPrompt = (items: SuggestionRow[], vocabTerms: string[], knownClusters: string[]): string =>
  `You group proposed vocabulary terms for a Yu-Gi-Oh! card-effect search engine. Each proposal came from a different card, so many describe the same concept in different words.

Give every proposal a "cluster": a short snake_case name for the concept it describes. Proposals for the same concept must get the same cluster name. If a proposal means the same as an EXISTING term, use that existing term as its cluster name. Reuse a known cluster name whenever it fits.

Existing terms: ${vocabTerms.join(', ')}
Known clusters: ${knownClusters.length ? knownClusters.join(', ') : '(none yet)'}

Proposals (id | kind | term | description | example phrase):
${items.map((s) => `${s.id} | ${s.kind} | ${s.proposed_term} | ${s.description ?? ''} | ${s.phrases[0] ?? ''}`).join('\n')}

Return {"assignments": [{"id": <id>, "cluster": "<snake_case>"}]} with one entry per proposal.`;

/** Pure: validates a clustering reply against the chunk it was for. */
export const parseClusterReply = (content: string, ids: number[]): Map<number, string> => {
  const parsed = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')) as { assignments?: { id?: unknown; cluster?: unknown }[] };
  const wanted = new Set(ids);
  const out = new Map<number, string>();
  for (const a of parsed.assignments ?? []) {
    if (typeof a.id !== 'number' || !wanted.has(a.id) || typeof a.cluster !== 'string') continue;
    const cluster = a.cluster
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (/^[a-z][a-z0-9_]*$/.test(cluster)) out.set(a.id, cluster);
  }
  return out;
};

/**
 * Assigns `cluster_key` to pending suggestions that don't have one, in chunks, carrying the clusters
 * found so far into later chunks so names stay consistent. Returns how many were clustered.
 */
export const clusterSuggestions = async (
  db: Db,
  client: ChatClient,
  model: ModelInfo,
  chunkSize = 120,
): Promise<{ clustered: number; costUsd: number }> => {
  const pending = await fetchAll((from, to) =>
    db
      .from('effect_vocab_suggestions')
      .select('id,kind,proposed_term,description,phrases')
      .eq('status', 'pending')
      .is('cluster_key', null)
      .order('occurrences', { ascending: false })
      .range(from, to),
  );
  if (!pending.length) return { clustered: 0, costUsd: 0 };
  const { vocab } = await loadVocab(db);
  const vocabTerms = [...new Set([...vocab.actionVerbs, ...vocab.eventVerbs, ...vocab.zones])];
  const known = await fetchAll((from, to) =>
    db.from('effect_vocab_suggestions').select('cluster_key').not('cluster_key', 'is', null).range(from, to),
  );
  const clusters = new Set(known.map((k) => k.cluster_key!));

  let clustered = 0;
  let costUsd = 0;
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize) as SuggestionRow[];
    const res = await client({
      model: model.id,
      messages: [{ role: 'user', content: buildClusterPrompt(chunk, vocabTerms, [...clusters].slice(0, 400)) }],
      jsonSchema: { name: 'clusters', schema: CLUSTER_SCHEMA },
      reasoningEffort: model.reasoning ? model.reasoning[0] : undefined,
      temperature: 0,
      maxTokens: 8000,
    });
    costUsd += usageCostUsd(model, res.usage);
    let assignments: Map<number, string>;
    try {
      assignments = parseClusterReply(
        res.content,
        chunk.map((s) => s.id),
      );
    } catch {
      continue; // Unparseable chunk: those suggestions stay unclustered and are retried next run.
    }
    for (const [id, cluster] of assignments) {
      const { error } = await db.from('effect_vocab_suggestions').update({ cluster_key: cluster, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
      clusters.add(cluster);
      clustered++;
    }
  }
  return { clustered, costUsd };
};

// ---------------------------------------------------------------------------
// Re-tag requests
// ---------------------------------------------------------------------------

/** Marks tagged cards for re-tagging (picked up by the next run). Returns how many were marked. */
export const requestRetag = async (db: Db, cardIds: number[], reason: string): Promise<number> => {
  if (!cardIds.length) return 0;
  const { data, error } = await db.rpc('effect_request_retag', { p_card_ids: cardIds, p_reason: reason });
  if (error) throw new Error(error.message);
  return data;
};

/** Cards whose text contains any of the phrases (case-insensitive), capped; for targeted re-tags. */
export const cardsMatchingPhrases = async (db: Db, phrases: string[], cap = 300): Promise<number[]> => {
  const ids = new Set<number>();
  for (const phrase of phrases) {
    const term = phrase.trim();
    if (term.length < 6) continue; // Too short to be specific.
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await db.from('neuron_cards').select('id').eq('language', 'en').ilike('effect_text', `%${escaped}%`).limit(cap);
    if (error) throw new Error(error.message);
    for (const r of data) ids.add(r.id);
    if (ids.size >= cap) break;
  }
  return [...ids].slice(0, cap);
};

export type RunLog = {
  batches: number;
  stored: number;
  drafted: number;
  failed: number;
  costUsd: number;
  failures: { card_id: number; error: string }[];
};

/** JSON-safe summary for Workflow step outputs. */
export const toJson = (v: unknown): Json => JSON.parse(JSON.stringify(v)) as Json;
