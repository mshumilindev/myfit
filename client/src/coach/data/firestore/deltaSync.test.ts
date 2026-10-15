import { describe, expect, it } from 'vitest';
import {
  DELTA_MARGIN_MS,
  FULL_RESYNC_MS,
  INVALID_ENTRY,
  changedSinceFor,
  deltaCats,
  mergeDelta,
  settleDelta,
  tokenOf,
  type DeltaEntry,
} from './deltaSync';
import type { ReadCategory } from './worldMap';
import type { Consent } from '../../domain/types';

const NOW = 1_800_000_000_000;
const H = 3_600_000;
const w = (id: string, startedAt: number, updatedAt: number, extra = {}) => ({
  id,
  startedAt,
  finishedAt: startedAt + H,
  updatedAt,
  ...extra,
});
const A = w('a', 1000, 10);
const B = w('b', 2000, 20);
const C = w('c', 3000, 30);

const entry = (over: Partial<DeltaEntry> = {}): DeltaEntry => ({
  fullAt: NOW - H,
  lastAt: NOW - H,
  consentVersion: 3,
  keyEpoch: 2,
  docs: { sets: [C, B, A] },
  ...over,
});
const cur = { consentVersion: 3, keyEpoch: 2 };

describe('deltaCats: only workout-based categories at full consent', () => {
  const consent = (o: Partial<Consent>) =>
    ({ totals: 'off', sets: 'off', injury: 'full', ...o }) as Consent;
  it('picks totals / sets at full, never effects or off or injury', () => {
    expect(
      deltaCats(consent({ totals: 'full', sets: 'full' }), ['totals', 'sets', 'injury']),
    ).toEqual(['totals', 'sets']);
    expect(
      deltaCats(consent({ totals: 'effects', sets: 'full' }), ['totals', 'sets', 'injury']),
    ).toEqual(['sets']);
    expect(deltaCats(consent({ totals: 'effects' }), ['totals', 'injury'])).toEqual([]);
  });
});

describe('changedSinceFor: when a delta may be asked for (0 = a full read)', () => {
  it('a young entry with equal consent / epoch asks for the changes since the last read minus a margin', () => {
    expect(changedSinceFor(entry(), NOW, cur, ['sets'])).toBe(NOW - H - DELTA_MARGIN_MS);
  });
  it.each([
    ['no entry', null],
    ['full read older than 24 h', entry({ fullAt: NOW - FULL_RESYNC_MS - 1 })],
    ['full read exactly 24 h old', entry({ fullAt: NOW - FULL_RESYNC_MS })],
    ['full read in the future', entry({ fullAt: NOW + 5 })],
    ['last read in the future', entry({ lastAt: NOW + 5 })],
    ['consent version changed', entry({ consentVersion: 2 })],
    ['key epoch changed', entry({ keyEpoch: 1 })],
    ['category missing from the cache', entry({ docs: { totals: [A] } })],
    ['different category set', entry({ docs: { sets: [A], totals: [A] } })],
    ['invalid marker', INVALID_ENTRY],
  ])('%s -> full', (_n, e) => {
    expect(changedSinceFor(e, NOW, cur, ['sets'])).toBe(0);
  });
  it('a different consent version on the roster than on the cache -> full', () => {
    expect(changedSinceFor(entry(), NOW, { consentVersion: 4, keyEpoch: 2 }, ['sets'])).toBe(0);
  });
  it('never negative', () => {
    expect(changedSinceFor(entry({ lastAt: 5 }), NOW, cur, ['sets'])).toBe(0);
  });
});

describe('mergeDelta: upsert by id, newest first, null on any shape surprise', () => {
  it('adds, updates and keeps; sorted by startedAt desc then id desc', () => {
    const b2 = w('b', 2000, 99, { note: 'edited' });
    const d = w('d', 4000, 40);
    expect(mergeDelta([C, B, A], [b2, d])).toEqual([d, C, b2, A]);
  });
  it('does not mutate its inputs', () => {
    const prev = [C, A];
    const snap = JSON.stringify(prev);
    mergeDelta(prev, [B]);
    expect(JSON.stringify(prev)).toBe(snap);
  });
  it('no previous docs = the delta alone', () => {
    expect(mergeDelta(undefined, [A, B])).toEqual([B, A]);
  });
  it.each([
    ['no id', { startedAt: 1, updatedAt: 1 }],
    ['empty id', { id: '', startedAt: 1, updatedAt: 1 }],
    ['no updatedAt', { id: 'x', startedAt: 1 }],
    ['string updatedAt', { id: 'x', startedAt: 1, updatedAt: '5' }],
    ['no startedAt', { id: 'x', updatedAt: 1 }],
    ['NaN startedAt', { id: 'x', startedAt: NaN, updatedAt: 1 }],
    ['not an object', 'x'],
    ['null', null],
  ])('a delta doc with %s -> null', (_n, bad) => {
    expect(mergeDelta([A], [bad as never])).toBeNull();
  });
  it('a bad cached doc -> null', () => {
    expect(mergeDelta([{ id: 'z' } as never], [A])).toBeNull();
  });
});

describe('tokenOf', () => {
  it('counts and sums updatedAt', () => {
    expect(tokenOf([A, B, C])).toEqual({ count: 3, sum: 60 });
  });
});

describe('settleDelta: merge + verify, or ask for a full read', () => {
  const ok = (docs: unknown[], token: unknown, level = 'full', delta: unknown = true) =>
    ({ state: 'ok', level, asOf: NOW, docs, delta, token }) as unknown as ReadCategory;
  const base = {
    cats: ['sets'] as const,
    consentVersion: 3,
    keyEpoch: 2,
    serverTime: NOW,
    resConsentVersion: 3,
  };

  it('a delta that merges to the server token -> the full docs, cache updated, lastAt moved, fullAt kept', () => {
    const b2 = w('b', 2000, 99);
    const s = settleDelta({
      ...base,
      cats: ['sets'],
      entry: entry(),
      changedSince: 5,
      results: { sets: ok([b2], { count: 3, sum: 10 + 99 + 30 }) },
    });
    expect(s.failed).toEqual([]);
    expect((s.results.sets as { docs: unknown[] }).docs).toEqual([C, b2, A]);
    expect(s.entry).toMatchObject({ fullAt: NOW - H, lastAt: NOW, docs: { sets: [C, b2, A] } });
  });

  it('changedSince 0 is a full read: the cache is rebuilt from the answer and fullAt moves', () => {
    const s = settleDelta({
      ...base,
      entry: entry({ docs: { sets: [A] } }), // stale content is ignored
      changedSince: 0,
      results: { sets: ok([A, B, C], { count: 3, sum: 60 }) },
    });
    expect(s.failed).toEqual([]);
    expect(s.entry).toMatchObject({ fullAt: NOW, lastAt: NOW });
    expect((s.results.sets as { docs: unknown[] }).docs).toEqual([C, B, A]);
  });

  it('totals: updatedAt is stripped from what is handed on but kept in the cache', () => {
    const s = settleDelta({
      ...base,
      cats: ['totals'],
      entry: null,
      changedSince: 0,
      results: { totals: ok([A, B], { count: 2, sum: 30 }) },
    });
    const docs = (s.results.totals as { docs: Record<string, unknown>[] }).docs;
    expect(docs.every((d) => !('updatedAt' in d))).toBe(true);
    expect(docs.map((d) => d.id)).toEqual(['b', 'a']);
    expect(s.entry!.docs.totals!.every((d) => typeof d.updatedAt === 'number')).toBe(true);
  });

  it.each([
    ['a deleted workout (count lower on the server)', [], { count: 2, sum: 40 }],
    ['an added workout we did not receive (count higher)', [], { count: 4, sum: 60 }],
    ['an edit we did not receive (sum differs)', [], { count: 3, sum: 61 }],
    ['delete + add (same count, other sum)', [w('d', 4000, 40)], { count: 3, sum: 70 }],
  ])('%s -> failed, nothing cached', (_n, delta, token) => {
    const s = settleDelta({
      ...base,
      entry: entry(),
      changedSince: 5,
      results: { sets: ok(delta, token) },
    });
    expect(s.failed).toEqual(['sets']);
    expect(s.entry).toBeNull();
  });

  it.each([
    ['no token', undefined],
    ['non-numeric token', { count: '3', sum: 60 }],
    ['negative count', { count: -1, sum: 0 }],
    ['fractional sum', { count: 3, sum: 60.5 }],
    ['NaN', { count: 3, sum: NaN }],
  ])('a delta answer with %s -> failed', (_n, token) => {
    const s = settleDelta({
      ...base,
      entry: entry(),
      changedSince: 5,
      results: { sets: ok([], token) },
    });
    expect(s.failed).toEqual(['sets']);
  });

  it('docs that are not an array -> failed', () => {
    const s = settleDelta({
      ...base,
      entry: entry(),
      changedSince: 5,
      results: {
        sets: {
          state: 'ok',
          level: 'full',
          asOf: 1,
          delta: true,
          token: { count: 3, sum: 60 },
        } as never,
      },
    });
    expect(s.failed).toEqual(['sets']);
  });

  it('delta without a cache to merge into (changedSince > 0 but the entry is gone) -> failed', () => {
    const s = settleDelta({
      ...base,
      entry: null,
      changedSince: 5,
      results: { sets: ok([C], { count: 1, sum: 30 }) },
    });
    expect(s.failed).toEqual(['sets']);
  });

  it('the server answering delta:false or not knowing deltas passes the plain answer through, nothing cached', () => {
    const plain = { state: 'ok', level: 'full', asOf: 1, docs: [A, B] } as unknown as ReadCategory;
    for (const delta of [false, undefined]) {
      const s = settleDelta({
        ...base,
        entry: entry(),
        changedSince: 5,
        results: { sets: { ...plain, ...(delta === false ? { delta } : {}) } as ReadCategory },
      });
      expect(s.failed).toEqual([]);
      expect(s.results.sets).toEqual(plain); // delta flag removed: the structure is that of a full read
      expect(s.entry).toBeNull();
    }
  });

  it('locked / not-applicable / effects pass through untouched', () => {
    const locked = { state: 'locked' } as ReadCategory;
    const eff = {
      state: 'ok',
      level: 'effects',
      asOf: 1,
      view: { weeks: [] },
      delta: false,
    } as unknown as ReadCategory;
    const s = settleDelta({
      ...base,
      cats: ['totals', 'sets'],
      entry: null,
      changedSince: 0,
      results: { totals: eff, sets: locked },
    });
    expect(s.results).toEqual({
      totals: { state: 'ok', level: 'effects', asOf: 1, view: { weeks: [] } },
      sets: locked,
    });
    expect(s.failed).toEqual([]);
    expect(s.entry).toBeNull();
  });

  it('a consent version in the answer that differs from the one asked under is stored as answered', () => {
    const s = settleDelta({
      ...base,
      resConsentVersion: 4,
      entry: null,
      changedSince: 0,
      results: { sets: ok([A], { count: 1, sum: 10 }) },
    });
    expect(s.entry!.consentVersion).toBe(4);
  });

  it('one category failing keeps the other one verified in the results, but nothing is cached', () => {
    const s = settleDelta({
      ...base,
      cats: ['totals', 'sets'],
      entry: null,
      changedSince: 0,
      results: { totals: ok([A], { count: 1, sum: 10 }), sets: ok([A], { count: 2, sum: 10 }) },
    });
    expect(s.failed).toEqual(['sets']);
    expect(s.entry).toBeNull();
    expect((s.results.totals as { docs: unknown[] }).docs).toHaveLength(1);
  });

  it('extras of totals full are passed through from the answer, not cached', () => {
    const r = {
      ...ok([A], { count: 1, sum: 10 }),
      extras: [{ enc: 'x' }],
    } as unknown as ReadCategory;
    const s = settleDelta({
      ...base,
      cats: ['totals'],
      entry: null,
      changedSince: 0,
      results: { totals: r },
    });
    expect((s.results.totals as { extras: unknown[] }).extras).toEqual([{ enc: 'x' }]);
    expect(JSON.stringify(s.entry)).not.toContain('"x"');
  });
});
