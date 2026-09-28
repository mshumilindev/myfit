import { describe, expect, it } from 'vitest';
import { markSeen, placeNote } from './noteSeen';
import { outOfQuiet, planNotePushes, type NoteLike } from './schedule';
import { COACH_DEFAULT } from './types';

const H = 3_600_000;
const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m).getTime();

describe('note placement', () => {
  it('keeps a note at its fact time when nothing was said after it', () => {
    expect(placeNote(at(10), at(12), [at(9)])).toBe(at(10));
  });
  it('moves a late-learned note below messages already exchanged', () => {
    // Fact at 10:00, you chatted at 11:00, the note only showed up at 12:00.
    expect(placeNote(at(10), at(12), [at(11)])).toBe(at(12));
  });
  it('first-seen marks are recorded once and old ones pruned', () => {
    const m = markSeen({ old: at(0) - 40 * 24 * H }, ['a'], at(12));
    expect(m).toEqual({ a: at(12) });
    expect(markSeen(m, ['a'], at(13))).toBe(m);
  });
});

describe('note pushes', () => {
  it('quiet hours wait for the morning', () => {
    expect(outOfQuiet(at(23))).toBe(new Date(2026, 8, 27, 9).getTime());
    expect(outOfQuiet(at(2, 27))).toBe(at(9));
    expect(outOfQuiet(at(15))).toBe(at(15));
  });
  it('a note that appears later becomes a push at that moment, known ones do not', () => {
    const now = at(8);
    const feed = (t: number): NoteLike[] => [
      { id: 'old', at: at(7), kind: 'pr', text: 'old' },
      ...(t >= at(14) ? [{ id: 'streak:1', at: at(14), kind: 'streak', text: 'Streak!' }] : []),
      ...(t >= at(19) ? [{ id: 'week:1', at: at(19), kind: 'week', text: 'Week' }] : []),
    ];
    const out = planNotePushes({
      coach: { ...COACH_DEFAULT, enabled: true },
      now,
      notesAt: feed,
      title: 'Atlas',
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ dueAt: at(14), body: 'Streak!', url: '/#/coach' });
  });
  it('nothing while Atlas is off or muted', () => {
    const feed = (t: number): NoteLike[] =>
      t > at(9) ? [{ id: 'n', at: at(12), kind: 'streak', text: 'x' }] : [];
    expect(
      planNotePushes({
        coach: { ...COACH_DEFAULT, enabled: false },
        now: at(8),
        notesAt: feed,
        title: '',
      }),
    ).toEqual([]);
    expect(
      planNotePushes({
        coach: { ...COACH_DEFAULT, enabled: true, mutedUntil: at(20) },
        now: at(8),
        notesAt: feed,
        title: '',
      }),
    ).toEqual([]);
  });
});
