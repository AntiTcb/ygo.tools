import { describe, expect, it } from 'vitest';
import { decodeQuery, describeQuery, encodeQuery, searchQuerySchema, type SearchQuery } from './query';
import { checkParserReply } from './queryParser';

const toadally: SearchQuery = searchQuerySchema.parse({
  mode: 'does',
  verb: 'special_summon',
  from_zones: ['gy'],
  target: { card: 'Toadally Awesome' },
});
const atlantean: SearchQuery = searchQuerySchema.parse({
  mode: 'responds_to',
  verb: 'send_to_gy',
  subject_is_self: true,
  cause: 'cost',
  cause_card: { attributes: ['WATER'], card_types: ['monster'] },
  card_filter: { card_types: ['monster'] },
});

describe('encodeQuery / decodeQuery', () => {
  it('round-trips queries, including non-ASCII names', () => {
    expect(decodeQuery(encodeQuery(toadally))).toEqual(toadally);
    expect(decodeQuery(encodeQuery(atlantean))).toEqual(atlantean);
    const accented = { ...toadally, target: { card: 'Ultimate Tyranno — Cœur' } };
    expect(decodeQuery(encodeQuery(accented))).toEqual(accented);
  });

  it('produces URL-safe output without default-valued fields', () => {
    const encoded = encodeQuery(toadally);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeQuery(toadally).length).toBeLessThan(encodeQuery({ ...toadally, to_zones: ['hand'] }).length);
  });

  it('returns null for malformed, stale or invalid links', () => {
    expect(decodeQuery(null)).toBeNull();
    expect(decodeQuery('not base64 !!')).toBeNull();
    expect(decodeQuery(btoa(JSON.stringify({ v: 999, mode: 'does', verb: 'x' })))).toBeNull();
    expect(decodeQuery(btoa(JSON.stringify({ v: 1, mode: 'sometimes', verb: 'x' })))).toBeNull();
    expect(decodeQuery('a'.repeat(5000))).toBeNull();
  });
});

describe('describeQuery', () => {
  it('renders the query in English', () => {
    expect(describeQuery(toadally)).toBe('Cards that special summon "Toadally Awesome" from gy');
    expect(describeQuery({ ...toadally, is_cost: true })).toContain('as a cost');
    expect(describeQuery(atlantean)).toMatch(/respond to send to gy of themselves by cost of WATER monster/);
  });
});

describe('checkParserReply', () => {
  const vocab = { actionVerbs: ['special_summon', 'send_to_gy'], eventVerbs: ['send_to_gy'], zones: ['gy', 'hand', 'deck'] };

  it('accepts a valid query, also inside a code fence', () => {
    expect(checkParserReply(JSON.stringify({ query: toadally }), vocab)).toEqual({ reply: { query: toadally } });
    expect(checkParserReply(`\`\`\`json\n${JSON.stringify({ query: toadally })}\n\`\`\``, vocab)).toEqual({ reply: { query: toadally } });
  });

  it('accepts an unsupported reply', () => {
    expect(checkParserReply('{"unsupported":"not about effects"}', vocab)).toEqual({ reply: { unsupported: 'not about effects' } });
  });

  it('rejects broken JSON, verbs of the wrong kind and unknown zones', () => {
    expect(checkParserReply('{"query":', vocab)).toMatchObject({ error: expect.stringContaining('not valid JSON') });
    expect(checkParserReply(JSON.stringify({ query: { ...atlantean, verb: 'special_summon' } }), vocab)).toMatchObject({
      error: expect.stringContaining('event verb'),
    });
    expect(checkParserReply(JSON.stringify({ query: { ...toadally, from_zones: ['moon'] } }), vocab)).toMatchObject({ error: 'unknown zone "moon"' });
  });
});
