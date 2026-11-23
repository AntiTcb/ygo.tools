import { describe, expect, it } from 'vitest';
import { ChatError, type ChatClient, type ChatRequest } from './ai';
import { parseSearchRequest, type ParserConfig } from './queryParser';

const vocab = { actionVerbs: ['send_to_gy', 'draw'], eventVerbs: ['destroyed'], zones: ['deck', 'gy'] };
const usage = { promptTokens: 10, cachedPromptTokens: 0, completionTokens: 5 };
const good = JSON.stringify({ query: { mode: 'does', verb: 'draw' } });
const badVerb = JSON.stringify({ query: { mode: 'does', verb: 'destroyed' } });

/** A client that answers each call from the script for its model, recording the models called. */
const scripted = (script: Record<string, (string | Error)[]>) => {
  const calls: string[] = [];
  const client: ChatClient = async (req: ChatRequest) => {
    calls.push(req.model);
    const next = script[req.model]!.shift()!;
    if (next instanceof Error) throw next;
    return { content: next, usage };
  };
  return { client, calls };
};

const config = (client: ChatClient, fallback = true): ParserConfig => ({
  client,
  model: 'primary',
  systemPrompt: 'prompt',
  jsonSchema: {},
  vocab,
  retryDelayMs: 0,
  fallbacks: fallback ? [{ model: 'backup' }] : [],
});

const rateLimited = () => new ChatError('Workers AI 429: rate limiting', 429, true);

describe('parseSearchRequest', () => {
  it('retries a rate-limited model once', async () => {
    const { client, calls } = scripted({ primary: [rateLimited(), good] });
    const res = await parseSearchRequest('draw 2', config(client));
    expect(res.ok).toBe(true);
    expect(calls).toEqual(['primary', 'primary']);
  });

  it('falls back to the next model when one stays rate limited', async () => {
    const { client, calls } = scripted({ primary: [rateLimited(), rateLimited()], backup: [good] });
    const res = await parseSearchRequest('draw 2', config(client));
    expect(res.ok && 'query' in res.reply && res.reply.query.verb).toBe('draw');
    expect(calls).toEqual(['primary', 'primary', 'backup']);
  });

  it('falls back after invalid output survives the corrective retry', async () => {
    const { client, calls } = scripted({ primary: [badVerb, badVerb], backup: [good] });
    expect((await parseSearchRequest('draw 2', config(client))).ok).toBe(true);
    expect(calls).toEqual(['primary', 'primary', 'backup']);
  });

  it('does not retry a request the model rejects, and reports every model', async () => {
    const bad = new ChatError('Workers AI 400: bad request', 400, false);
    const { client, calls } = scripted({ primary: [bad], backup: [bad] });
    const res = await parseSearchRequest('draw 2', config(client));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/primary: .*400.*\| backup: .*400/);
    expect(calls).toEqual(['primary', 'backup']);
  });

  it('takes an "unsupported" reply as the answer', async () => {
    const { client, calls } = scripted({ primary: [JSON.stringify({ unsupported: 'not about cards' })] });
    const res = await parseSearchRequest('best deck?', config(client));
    expect(res.ok && 'unsupported' in res.reply).toBe(true);
    expect(calls).toEqual(['primary']);
  });
});
