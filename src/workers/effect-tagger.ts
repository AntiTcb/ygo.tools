import { createClient } from '@supabase/supabase-js';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Database } from '../lib/db/database.types';
import { isModelKey, MODELS, workersAiBindingClient, type AiBinding } from '../lib/effect-search/ai';
import type { Db } from '../lib/effect-search/db';
import {
  buildTaggerConfig,
  clusterSuggestions,
  detectWork,
  finishRun,
  loadQueue,
  refreshDerivedData,
  startRun,
  tagBatch,
  updateRunProgress,
  type RunPlan,
} from '../lib/effect-search/runner';

/** Bindings, vars and secrets from wrangler.effect-tagger.jsonc. */
export interface TaggerEnv {
  AI: AiBinding;
  EFFECT_TAG_WORKFLOW: Workflow<TagWorkflowParams>;
  SUPABASE_URL: string;
  /** Secret. */
  SUPABASE_SERVICE_KEY: string;
  /** Key into MODELS (src/lib/effect-search/ai.ts). */
  TAG_MODEL: string;
  /** Model for the end-of-run suggestion clustering. */
  CLUSTER_MODEL: string;
  /** AI Gateway id; unset = call Workers AI directly. */
  AI_GATEWAY_ID?: string;
  /** Cards per Workflow step. */
  BATCH_SIZE?: string;
  /** Most cards one run takes on; the rest wait for the next cron tick. */
  MAX_CARDS_PER_RUN?: string;
}

export type TagWorkflowParams = { plan: RunPlan };

const supabase = (env: TaggerEnv): Db => createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const model = (key: string) => {
  if (!isModelKey(key)) throw new Error(`unknown model ${key}`);
  return MODELS[key];
};

const STEP = { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' }, timeout: '30 minutes' } as const;

/**
 * One tagging run: re-tags whatever is in effect_tag_queue (new/changed cards, re-tag requests) in
 * durable batches, then clusters new vocabulary suggestions. Progress lives in effect_tag_runs, which
 * /admin shows. Each step is idempotent: a retried batch re-tags cards still in the queue.
 */
export class EffectTagWorkflow extends WorkflowEntrypoint<TaggerEnv, TagWorkflowParams> {
  async run(event: Readonly<WorkflowEvent<TagWorkflowParams>>, step: WorkflowStep) {
    const { plan } = event.payload;
    const tagModel = model(this.env.TAG_MODEL);

    const runId = await step.do('start', STEP, async () => {
      const db = supabase(this.env);
      const id = await startRun(db, plan, tagModel.id, event.instanceId);
      if (plan.kind === 'import') await refreshDerivedData(db);
      return id;
    });

    try {
      const queue = await step.do('load queue', STEP, async () => {
        const items = await loadQueue(supabase(this.env));
        return items.slice(0, Number(this.env.MAX_CARDS_PER_RUN ?? 5000));
      });
      await step.do('record total', STEP, async () => updateRunProgress(supabase(this.env), runId, { total: queue.length, done: 0, failed: 0 }));

      const batchSize = Number(this.env.BATCH_SIZE ?? 20);
      let done = 0;
      let failed = 0;
      for (let i = 0; i < queue.length; i += batchSize) {
        const batch = queue.slice(i, i + batchSize);
        const res = await step.do(`batch ${i / batchSize}`, STEP, async () => {
          const db = supabase(this.env);
          const cfg = await buildTaggerConfig(db, workersAiBindingClient(this.env.AI, this.env.AI_GATEWAY_ID), tagModel);
          const out = await tagBatch(db, cfg, tagModel, batch);
          // Progress counts are cumulative; replays return the cached result, so this stays correct.
          await updateRunProgress(db, runId, { done: done + out.stored + out.drafted, failed: failed + out.failed.length });
          return { stored: out.stored, drafted: out.drafted, failed: out.failed.length, costUsd: out.costUsd };
        });
        done += res.stored + res.drafted;
        failed += res.failed;
      }

      await step.do('cluster suggestions', STEP, async () => {
        const client = workersAiBindingClient(this.env.AI, this.env.AI_GATEWAY_ID);
        return clusterSuggestions(supabase(this.env), client, model(this.env.CLUSTER_MODEL));
      });

      await step.do('finish', STEP, async () => finishRun(supabase(this.env), runId, 'completed', null));
      return { runId, done, failed };
    } catch (e) {
      await step.do('mark failed', STEP, async () => finishRun(supabase(this.env), runId, 'failed', (e as Error).message.slice(0, 1000)));
      throw e;
    }
  }
}

/**
 * Hourly: start a tagging run when there's something to do (a new Neuron import, re-tag requests, or
 * cards left in the queue). /admin's "Run now" starts runs directly through the Workflow binding.
 * A separate Worker because adapter-cloudflare owns the site Worker's entrypoint.
 */
export default {
  async scheduled(_controller: unknown, env: TaggerEnv): Promise<void> {
    const plan = await detectWork(supabase(env));
    // oxlint-disable-next-line no-console -- Worker logs are how cron runs are observed.
    console.log(plan ? `starting run: ${plan.reason}` : 'nothing to tag');
    if (plan) await env.EFFECT_TAG_WORKFLOW.create({ params: { plan } });
  },
};
