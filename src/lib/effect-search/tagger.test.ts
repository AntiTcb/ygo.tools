import { describe, expect, it } from 'vitest';
import { ChatError, MODELS, parseChatResponse, usageCostUsd, type ChatClient, type ChatRequest } from './ai';
import { cardTypeLine, type TaggableCardRow } from './cardText';
import { checkTaggerReply, tagCard, type TaggerConfig } from './tagger';
import type { Vocab } from './tagSchema';
import { EFFECT_ACTION_VERBS, EFFECT_EVENT_VERBS, EFFECT_ZONES } from './vocab.generated';

const vocab: Vocab = { actionVerbs: EFFECT_ACTION_VERBS, eventVerbs: EFFECT_EVENT_VERBS, zones: EFFECT_ZONES };
const card = { name: 'Pot of Greed', typeLine: 'Normal Spell', effectText: 'Draw 2 cards.', pendulumText: null };
const good = JSON.stringify({
  effects: [{ effect_index: 0, snippet: 'Draw 2 cards.', effect_type: 'activation', actions: [{ verb: 'draw', quantity: 2 }] }],
});
const usage = { promptTokens: 1000, cachedPromptTokens: 800, completionTokens: 100 };

const scripted = (replies: (string | Error)[]) => {
  const calls: ChatRequest[] = [];
  const client: ChatClient = async (req) => {
    calls.push(structuredClone(req));
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return { content: next!, usage };
  };
  return { client, calls };
};

const cfg = (client: ChatClient): TaggerConfig => ({ client, model: 'm', systemPrompt: 'sys', jsonSchema: {}, vocab });

describe('checkTaggerReply', () => {
  it('accepts fenced JSON and reports schema and vocabulary problems', () => {
    expect('output' in checkTaggerReply(`\`\`\`json\n${good}\n\`\`\``, vocab)).toBe(true);
    expect(checkTaggerReply('nope', vocab)).toMatchObject({ errors: [expect.stringContaining('not valid JSON')] });
    expect(checkTaggerReply('{"effects":[{"effect_index":0}]}', vocab)).toMatchObject({
      errors: expect.arrayContaining([expect.stringContaining('effects.0.snippet')]),
    });
    const badVerb = good.replace('"draw"', '"yeet"');
    expect(checkTaggerReply(badVerb, vocab)).toEqual({ errors: ['effects[0].actions[0]: "yeet" is not an action verb'] });
  });
});

describe('tagCard', () => {
  it('feeds validation errors back and succeeds on the corrected reply', async () => {
    const { client, calls } = scripted([good.replace('"draw"', '"yeet"'), good]);
    const res = await tagCard(card, cfg(client));
    expect(res).toMatchObject({ ok: true, attempts: 2 });
    expect(res.usage.promptTokens).toBe(2000);
    expect(calls[1]!.messages.at(-1)!.content).toContain('"yeet" is not an action verb');
    expect(calls[1]!.messages.at(-2)!.role).toBe('assistant');
  });

  it('gives up after maxAttempts invalid replies', async () => {
    const { client } = scripted(['{}', '{}']);
    expect(await tagCard(card, cfg(client))).toMatchObject({ ok: false, attempts: 2, lastContent: '{}' });
  });

  it('retries transient API errors without spending an attempt, but not permanent ones', async () => {
    const transient = scripted([new ChatError('busy', 429, true), good]);
    expect(await tagCard(card, { ...cfg(transient.client), maxAttempts: 1 })).toMatchObject({ ok: true, attempts: 1 });
    const permanent = scripted([new ChatError('bad token', 401, false)]);
    expect(await tagCard(card, cfg(permanent.client))).toMatchObject({ ok: false, error: 'bad token' });
  }, 10_000);
});

describe('usageCostUsd', () => {
  it('prices cached input separately', () => {
    // 200 uncached * 0.95 + 800 cached * 0.16 + 100 out * 4.00, per million
    expect(usageCostUsd(MODELS['kimi-k2.6'], usage)).toBeCloseTo((200 * 0.95 + 800 * 0.16 + 100 * 4) / 1e6, 12);
  });
});

describe('cardTypeLine', () => {
  const frames = new Map([
    [23, 'Xyz／Effect'],
    [43, 'Link／Effect'],
  ]);
  const base: TaggableCardRow = {
    id: 1,
    name: 'x',
    effect_text: null,
    pendulum_text: null,
    frame_type_id: 23,
    effect_id: 0,
    attribute_id: 3,
    species_id: 14,
    level: 2,
    link_rating: null,
    atk: 2200,
    def: 0,
  };
  it('renders monsters, links and spells/traps', () => {
    expect(cardTypeLine(base, frames)).toBe('Xyz/Effect Monster · Rank 2 · WATER · Aqua · ATK 2200 / DEF 0');
    expect(cardTypeLine({ ...base, frame_type_id: 43, level: null, link_rating: 2, def: null, atk: -1 }, frames)).toBe(
      'Link/Effect Monster · Link-2 · WATER · Aqua · ATK ?',
    );
    expect(cardTypeLine({ ...base, frame_type_id: 13, effect_id: 5 }, frames)).toBe('Quick-Play Spell');
    expect(cardTypeLine({ ...base, frame_type_id: 14, effect_id: 1 }, frames)).toBe('Counter Trap');
  });
});

describe('parseChatResponse', () => {
  it('assembles streamed deltas and takes usage from the final chunk', () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      'data: {"choices":[{"delta":{"content":"{\\"effects\\""}}]}',
      'data: {"choices":[{"delta":{"content":":[]}"}}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4,"prompt_tokens_details":{"cached_tokens":8}}}',
      'data: [DONE]',
      '',
    ].join('\n');
    expect(parseChatResponse(sse)).toEqual({ content: '{"effects":[]}', usage: { promptTokens: 10, cachedPromptTokens: 8, completionTokens: 4 } });
  });

  it('handles non-streamed completions and empty streams', () => {
    expect(parseChatResponse('{"choices":[{"message":{"content":"x"}}],"usage":{"prompt_tokens":1,"completion_tokens":2}}')).toEqual({
      content: 'x',
      usage: { promptTokens: 1, cachedPromptTokens: 0, completionTokens: 2 },
    });
    expect(parseChatResponse('data: {"choices":[{"delta":{}}]}\ndata: [DONE]\n').content).toBeNull();
  });
});

describe('tagCard retries', () => {
  it('retries broken JSON fresh at a higher temperature, without feeding the broken reply back', async () => {
    const { client, calls } = scripted(['{"effects": [\n\n\n\n', good]);
    const res = await tagCard(card, cfg(client));
    expect(res).toMatchObject({ ok: true, attempts: 2 });
    expect(calls[0]!.temperature).toBe(0);
    expect(calls[1]!.temperature).toBe(0.4);
    expect(calls[1]!.messages).toHaveLength(2);
  });

  it('repairs meaning-preserving slips instead of failing', () => {
    const slip = JSON.stringify({
      effects: [
        {
          effect_index: 0,
          snippet: 's',
          effect_type: 'trigger',
          triggers: [{ event: 'send_to_gy', subject_is_self: true, subject: { card_types: ['monster'] } }],
          actions: [
            { verb: 'draw', quantity: 1, stat_mode: 'gain' },
            { verb: 'inflict_damage', stat_mode: 'lose', stat_amount: 500 },
          ],
        },
      ],
    });
    const checked = checkTaggerReply(slip, vocab);
    expect('output' in checked).toBe(true);
    if ('output' in checked) {
      const [e] = checked.output.effects;
      expect(e!.triggers[0]!.subject).toBeNull();
      expect(e!.actions[0]).toMatchObject({ stat_mode: null });
      expect(e!.actions[1]).toMatchObject({ stat_mode: null, stat_amount: 500 });
    }
  });
});
