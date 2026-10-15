import { describe, expect, it } from 'vitest';
import { repairSnippets } from './snippets';

const fx = (effect_index: number, snippet: string, text_source: 'card' | 'pendulum' = 'card') => ({ effect_index, snippet, text_source });

const plugin =
  'Target 1 of your Xyz Monsters or "Ryzeal" monsters that is banished or in your GY; Special Summon it, also you cannot declare attacks for the rest of this turn, except with Rank 4 Xyz Monsters. You can only activate 1 "Ryzeal Plugin" per turn.';

const puppet =
  'Target monsters your opponent controls, up to the number of "Gimmick Puppet" Xyz Monsters you control; take control of those monsters until the End Phase. If this card is in your GY, except the turn it was sent there, and you control a "Gimmick Puppet" Xyz Monster: You can banish this card, then target 1 Xyz Monster in either GY; Special Summon it. You can only use each effect of "Service Puppet Play" once per turn.';

describe('repairSnippets', () => {
  it('extends a snippet cut at a quote to the end of the effect, without the once-per-turn line', () => {
    const [e] = repairSnippets([fx(0, 'Target 1 of your Xyz Monsters or ')], { card: plugin, pendulum: null });
    expect(e!.snippet).toBe(
      'Target 1 of your Xyz Monsters or "Ryzeal" monsters that is banished or in your GY; Special Summon it, also you cannot declare attacks for the rest of this turn, except with Rank 4 Xyz Monsters.',
    );
  });

  it('stops each effect where the next one starts', () => {
    const out = repairSnippets(
      [
        fx(0, 'Target monsters your opponent controls, up to the number of '),
        fx(1, 'If this card is in your GY, except the turn it was sent there, and you control a '),
      ],
      { card: puppet, pendulum: null },
    );
    expect(out[0]!.snippet).toBe(
      'Target monsters your opponent controls, up to the number of "Gimmick Puppet" Xyz Monsters you control; take control of those monsters until the End Phase.',
    );
    expect(out[1]!.snippet).toBe(
      'If this card is in your GY, except the turn it was sent there, and you control a "Gimmick Puppet" Xyz Monster: You can banish this card, then target 1 Xyz Monster in either GY; Special Summon it.',
    );
  });

  it('leaves complete or unmatched snippets alone', () => {
    const effects = [fx(0, 'Draw 2 cards.'), fx(1, 'paraphrased by the model')];
    expect(repairSnippets(effects, { card: 'Draw 2 cards. Then discard 1 "Frog" card.', pendulum: null })).toEqual(effects);
  });

  it('repairs Pendulum text against the Pendulum text', () => {
    const [e] = repairSnippets([fx(0, 'You can target 1 ', 'pendulum')], {
      card: null,
      pendulum: 'You can target 1 "Frog" card in your GY; add it to your hand.',
    });
    expect(e!.snippet).toBe('You can target 1 "Frog" card in your GY; add it to your hand.');
  });
});
