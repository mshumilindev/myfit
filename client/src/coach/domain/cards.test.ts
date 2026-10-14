// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cardLimit, pickCards } from './cards';
import type { Severity, Signal } from './types';
import { NOW } from './testBuilders';

const sig = (
  i: number,
  severity: Severity = 'watch',
  kind: Signal['kind'] = 'spike',
  client = `c${i}`,
): Signal => ({
  key: `${client}|${kind}|${i}`,
  clientId: client,
  kind,
  severity,
  confidence: 'high',
  strength: 50,
  exerciseKey: null,
  detectedAt: NOW,
  facts: {},
  evidence: [],
});
const many = (n: number) => Array.from({ length: n }, (_, i) => sig(i));

describe('card limits (R-BE-DEC-8)', () => {
  it.each([
    [0, 0],
    [7, 0],
    [8, 5],
    [14, 5],
    [20, 5],
    [21, 6],
    [40, 10],
    [60, 10],
    [100, 10],
  ])('roster %i -> %i cards', (roster, limit) => {
    expect(cardLimit(roster)).toBe(limit);
    const p = pickCards(many(30), roster);
    expect(p.cards.length).toBe(Math.min(limit, 30));
  });

  it('roster < 8: no queue, week briefs, everything goes to the digest count', () => {
    expect(pickCards(many(3), 7)).toEqual({ mode: 'week-briefs', cards: [], digest: 3 });
  });

  it('the remainder is the digest count (signals, not cards)', () => {
    const p = pickCards(many(9), 14);
    expect(p.cards).toHaveLength(5);
    expect(p.digest).toBe(4);
  });

  it('needs a decision first; same client never twice (merged with a count)', () => {
    const signals = [
      sig(1, 'good', 'pr', 'a'),
      sig(2, 'watch', 'spike', 'b'),
      sig(3, 'urgent', 'stall', 'c'),
      sig(4, 'watch', 'rhythm', 'c'),
      sig(5, 'urgent', 'injury', 'd'),
    ];
    const p = pickCards(signals, 14);
    expect(p.cards.map((c) => c.clientId)).toEqual(['c', 'd', 'b', 'a']);
    expect(p.cards[0]).toMatchObject({ count: 2, bucket: 'decide', primary: { kind: 'stall' } });
    expect(p.cards[0].signals.map((s) => s.kind)).toEqual(['stall', 'rhythm']);
    expect(p.cards.map((c) => c.bucket)).toEqual(['decide', 'decide', 'watch', 'watch']);
    expect(new Set(p.cards.map((c) => c.clientId)).size).toBe(p.cards.length);
    expect(p.digest).toBe(0);
  });

  it('empty input is an all-clear', () => {
    expect(pickCards([], 14)).toEqual({ mode: 'queue', cards: [], digest: 0 });
  });
});
