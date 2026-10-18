import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeen, markSeen, placeNote, resetSeenCache, saveSeen, seenFor } from './noteSeen';

const KEY = 'spotter.atlasNoteSeen';
const DAY = 86_400_000;

beforeEach(() => {
  localStorage.clear();
  resetSeenCache();
});
afterEach(() => vi.restoreAllMocks());

describe('loadSeen / saveSeen', () => {
  it('round-trips a map through storage', () => {
    saveSeen({ a: 1, b: 2 });
    expect(loadSeen()).toEqual({ a: 1, b: 2 });
  });
  it('treats missing, non-object and corrupt storage as empty', () => {
    expect(loadSeen()).toEqual({});
    localStorage.setItem(KEY, '42');
    expect(loadSeen()).toEqual({});
    localStorage.setItem(KEY, 'null');
    expect(loadSeen()).toEqual({});
    localStorage.setItem(KEY, '{nope');
    expect(loadSeen()).toEqual({});
  });
  it('survives unavailable storage in both directions', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadSeen()).toEqual({});
    expect(() => saveSeen({ a: 1 })).not.toThrow();
  });
});

describe('markSeen', () => {
  it('returns the very same object when nothing is new and nothing is stale', () => {
    const m = { a: 100 };
    expect(markSeen(m, ['a'], 200)).toBe(m);
  });
  it('adds first sight at now and never overwrites an earlier one', () => {
    const m = { a: 100 };
    const next = markSeen(m, ['a', 'b'], 500);
    expect(next).toEqual({ a: 100, b: 500 });
    expect(m).toEqual({ a: 100 });
  });
  it('drops marks strictly older than 30 days, keeps the 30-day-old edge', () => {
    const now = 100 * DAY;
    const next = markSeen({ old: now - 30 * DAY - 1, edge: now - 30 * DAY }, [], now);
    expect(next).toEqual({ edge: now - 30 * DAY });
  });
  it('prunes without mutating the input', () => {
    const now = 100 * DAY;
    const m = { old: 0 };
    markSeen(m, [], now);
    expect(m).toEqual({ old: 0 });
  });
});

describe('seenFor', () => {
  it('the very first run seeds every note with its own fact time and stores it', () => {
    const now = 50 * DAY;
    const r = seenFor(
      [
        { id: 'a', at: now - 3 * DAY },
        { id: 'b', at: now - DAY },
      ],
      now,
    );
    expect(r).toEqual({ a: now - 3 * DAY, b: now - DAY });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(r);
  });
  it('later runs stamp only the new note with now and persist the change', () => {
    const now = 50 * DAY;
    seenFor([{ id: 'a', at: now - DAY }], now);
    const r = seenFor(
      [
        { id: 'a', at: now - DAY },
        { id: 'late', at: now - 2 * DAY },
      ],
      now + 1000,
    );
    expect(r).toEqual({ a: now - DAY, late: now + 1000 });
    expect(loadSeen()).toEqual(r);
  });
  it('is idempotent: no rewrite when nothing changed', () => {
    const now = 50 * DAY;
    const notes = [{ id: 'a', at: now - DAY }];
    const first = seenFor(notes, now);
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    expect(seenFor(notes, now + 5)).toBe(first);
    expect(spy).not.toHaveBeenCalled();
  });
  it('uses what is already stored instead of reseeding', () => {
    const now = 50 * DAY;
    saveSeen({ a: now - 2 * DAY });
    expect(seenFor([{ id: 'a', at: now - DAY }], now)).toEqual({ a: now - 2 * DAY });
  });
});

describe('placeNote', () => {
  it('keeps the fact time when never seen or seen at/before the fact', () => {
    expect(placeNote(100, undefined, [150])).toBe(100);
    expect(placeNote(100, 100, [50, 150])).toBe(100);
    expect(placeNote(100, 90, [150])).toBe(100);
  });
  it('moves a late-learned note below a message sent in between', () => {
    expect(placeNote(100, 300, [200])).toBe(300);
  });
  it('keeps the fact time if no message falls strictly between', () => {
    expect(placeNote(100, 300, [])).toBe(100);
    expect(placeNote(100, 300, [100, 300])).toBe(100);
    expect(placeNote(100, 300, [50, 400])).toBe(100);
  });
});
