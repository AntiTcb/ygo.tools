import { describe, expect, it } from 'vitest';
import { ChatError, MODELS, parseChatResponse, usageCostUsd, type ChatClient, type ChatRequest } from './ai';
import { cardTypeLine, type TaggableCardRow } from './cardText';
import { checkTaggerReply, collapsedEffects, missingEffectText, tagCard, type TaggerConfig } from './tagger';
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
    // 200 uncached * 1.40 + 800 cached * 0.26 + 100 out * 4.40, per million
    expect(usageCostUsd(MODELS['glm-5.3'], usage)).toBeCloseTo((200 * 1.4 + 800 * 0.26 + 100 * 4.4) / 1e6, 12);
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

describe('missingEffectText', () => {
  const kingDragun =
    'Your opponent cannot target Dragon monsters with card effects.\nOnce per turn: You can Special Summon 1 Dragon monster from your hand.';

  it('reports activated effects that no snippet holds', () => {
    expect(missingEffectText(kingDragun, ['Your opponent cannot target Dragon monsters with card effects.'])).toEqual([
      'Once per turn: You can Special Summon 1 Dragon monster from your hand.',
    ]);
    expect(missingEffectText(kingDragun, kingDragun.split('\n'))).toEqual([]);
  });

  it('skips material lines, once-per-turn clauses, quoted names and "If you do" follow-ups', () => {
    const text =
      '1 Tuner + 1+ non-Tuners\nYou can only use each effect of "Number C39: Utopia Ray" once per turn. If this card is Summoned: You can draw 1 card. If you do: It gains 500 ATK.';
    expect(missingEffectText(text, ['If this card is Summoned: You can draw 1 card.'])).toEqual([]);
  });
});

describe('collapsedEffects', () => {
  it('finds an action-less effect holding several sentences with an activated one', () => {
    const whole =
      'Cannot be targeted. You can only use this effect once per turn. During your Main Phase: You can add 1 card from your Deck to your hand.';
    expect(collapsedEffects([{ snippet: whole, actions: [] }])).toEqual([0]);
    expect(collapsedEffects([{ snippet: whole, actions: [{}] }])).toEqual([]);
    expect(collapsedEffects([{ snippet: 'Cannot be destroyed by battle.', actions: [] }])).toEqual([]);
  });
});

describe('tagCard completeness', () => {
  const twoEffects = {
    name: 'King Dragun',
    typeLine: 'Fusion/Effect Monster',
    effectText:
      'Your opponent cannot target Dragon monsters with card effects.\nOnce per turn: You can Special Summon 1 Dragon monster from your hand.',
    pendulumText: null,
  };
  const first = {
    effect_index: 0,
    snippet: 'Your opponent cannot target Dragon monsters with card effects.',
    effect_type: 'continuous',
    actions: [{ verb: 'prevent_targeting' }],
  };
  const second = {
    effect_index: 1,
    snippet: 'Once per turn: You can Special Summon 1 Dragon monster from your hand.',
    effect_type: 'ignition',
    actions: [{ verb: 'special_summon', from_zones: ['hand'] }],
  };
  const short = JSON.stringify({ effects: [first] });
  const full = JSON.stringify({ effects: [first, second] });
  const withNewVerbs: Vocab = { ...vocab, actionVerbs: [...vocab.actionVerbs, 'prevent_targeting'] };

  it('asks once for effects it left out', async () => {
    const { client, calls } = scripted([short, full]);
    const res = await tagCard(twoEffects, { ...cfg(client), vocab: withNewVerbs });
    expect(res).toMatchObject({ ok: true, attempts: 2 });
    expect(res.ok && res.output.effects).toHaveLength(2);
    expect(calls[1]!.messages.at(-1)!.content).toContain('Once per turn: You can Special Summon 1 Dragon monster');
  });

  it('keeps a second short answer rather than failing the card', async () => {
    const { client } = scripted([short, short]);
    const res = await tagCard(twoEffects, { ...cfg(client), vocab: withNewVerbs });
    expect(res).toMatchObject({ ok: true, attempts: 2 });
    expect(res.ok && res.output.effects).toHaveLength(1);
  });
});
