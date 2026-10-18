import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workout } from '../types';
import type { Play } from '../playbook';

// Boundaries only: Firestore, the Firebase handle and the signed-in uid.
const fs = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  existing: [] as { id: string; data: Record<string, unknown> }[],
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock('../firebase', () => ({ db: { name: 'db' } }));
vi.mock('../api', () => ({ currentUid: () => fs.uid }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (col: { path: string }, id: string) => ({ path: `${col.path}/${id}` }),
  getDocs: async () => ({
    docs: fs.existing.map((e) => ({ id: e.id, ref: { path: `ref/${e.id}` }, data: () => e.data })),
  }),
  setDoc: fs.setDoc,
  deleteDoc: fs.deleteDoc,
}));

import {
  NOTE_LOOKAHEAD_H,
  QUIET_END_H,
  QUIET_START_H,
  REVIEW_H,
  chatBacked,
  outOfQuiet,
  planNotePushes,
  planOutbox,
  pushReplyNow,
  syncOutbox,
  type NoteLike,
  type OutboxMessage,
} from './schedule';
import { COACH_DEFAULT } from './types';
import type { Fmt } from './voice';

const H = 3_600_000;
const WED_NOON = new Date(2026, 9, 7, 12).getTime();
const coach = { ...COACH_DEFAULT, enabled: true };
const msg = (id: string, extra: Partial<OutboxMessage> = {}): OutboxMessage => ({
  id,
  dueAt: 1000,
  title: 'T',
  body: 'B',
  tag: 'tag',
  url: '/u',
  ...extra,
});

beforeEach(() => {
  fs.uid = 'u1';
  fs.existing = [];
  fs.setDoc.mockReset().mockResolvedValue(undefined);
  fs.deleteDoc.mockReset().mockResolvedValue(undefined);
});

describe('outOfQuiet', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m).getTime();
  it('keeps a time inside 09:00–22:00 (start inclusive, end exclusive)', () => {
    expect(outOfQuiet(at(QUIET_END_H))).toBe(at(QUIET_END_H));
    expect(outOfQuiet(at(21, 59))).toBe(at(21, 59));
  });
  it('moves the evening quiet hours to 09:00 the next morning', () => {
    expect(outOfQuiet(at(QUIET_START_H))).toBe(new Date(2026, 9, 8, 9).getTime());
    expect(outOfQuiet(at(23, 30))).toBe(new Date(2026, 9, 8, 9).getTime());
  });
  it('moves the small hours to 09:00 the same morning, dropping minutes', () => {
    expect(outOfQuiet(at(0, 5))).toBe(at(9));
    expect(outOfQuiet(at(8, 59))).toBe(at(9));
  });
  it('crosses a month boundary', () => {
    expect(outOfQuiet(new Date(2026, 9, 31, 23).getTime())).toBe(
      new Date(2026, 10, 1, 9).getTime(),
    );
  });
});

describe('planNotePushes', () => {
  const note = (id: string, at: number, kind = 'recovery', text = `say ${id}`): NoteLike => ({
    id,
    at,
    kind,
    text,
  });
  const NOW = new Date(2026, 9, 7, 10).getTime();
  const run = (notesAt: (t: number) => NoteLike[], extra: Record<string, unknown> = {}) =>
    planNotePushes({ coach, now: NOW, notesAt, title: 'Atlas', ...extra });

  it('says nothing when Atlas is off', () => {
    expect(run(() => [note('n', NOW + H)], { coach: { ...coach, enabled: false } })).toEqual([]);
  });
  it('does not push notes that already exist now', () => {
    expect(run(() => [note('old', NOW - H)])).toEqual([]);
  });
  it('pushes a note that appears later, at its own time when inside the step', () => {
    const at = NOW + 3 * H + 15 * 60_000;
    const out = run((t) => (t >= NOW + 4 * H ? [note('n:1', at, 'streak', 'Streak!')] : []));
    expect(out).toEqual([
      {
        id: 'note-n_1',
        dueAt: at,
        title: 'Atlas',
        body: 'Streak!',
        tag: 'atlas-streak',
        url: '/#/coach?note=n%3A1',
      },
    ]);
  });
  it('falls back to the sampling moment when the note time is outside the step', () => {
    const out = run((t) => (t >= NOW + 4 * H ? [note('late', NOW - 10 * H)] : []));
    expect(out[0].dueAt).toBe(NOW + 4 * H);
  });
  it('pushes each note once even though every later sample still has it', () => {
    const out = run((t) => (t >= NOW + 2 * H ? [note('n', NOW + 2 * H)] : []));
    expect(out).toHaveLength(1);
  });
  it('leaves notes the outbox plans elsewhere (skipped, week, intro)', () => {
    const out = run((t) =>
      t >= NOW + 2 * H
        ? [
            note('a', NOW + 2 * H, 'skipped'),
            note('b', NOW + 2 * H, 'week'),
            note('c', NOW + 2 * H, 'intro'),
          ]
        : [],
    );
    expect(out).toEqual([]);
  });
  it('never delivers in quiet hours', () => {
    const night = new Date(2026, 9, 7, 23).getTime();
    const out = planNotePushes({
      coach,
      now: night,
      title: 'A',
      stepH: 1,
      notesAt: (t) => (t >= night + H ? [note('n', night + H)] : []),
    });
    expect(out[0].dueAt).toBe(new Date(2026, 9, 8, 9).getTime());
  });
  it('is never due earlier than a minute from now', () => {
    const out = run((t) => (t > NOW ? [note('n', NOW - H)] : []));
    expect(out[0].dueAt).toBeGreaterThanOrEqual(NOW + 60_000);
  });
  it('skips what lands inside a mute, keeps what lands after it', () => {
    const notes = (t: number) => (t >= NOW + 2 * H ? [note('n', NOW + 2 * H)] : []);
    expect(run(notes, { coach: { ...coach, mutedUntil: NOW + 3 * H } })).toEqual([]);
    expect(run(notes, { coach: { ...coach, mutedUntil: NOW + 2 * H } })).toHaveLength(1);
  });
  it('sanitises and caps the id, and looks ahead 36 h only', () => {
    const long = 'x/y z'.repeat(60);
    const out = run((t) => (t > NOW ? [note(long, NOW + H)] : []));
    expect(out[0].id).toBe(`note-${long.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)}`);
    expect(out[0].id.length).toBe(5 + 120);
    const seen: number[] = [];
    run((t) => {
      seen.push(t);
      return [];
    });
    expect(Math.max(...seen)).toBe(NOW + NOTE_LOOKAHEAD_H * H);
    expect(seen).toContain(NOW + 2 * H);
  });
  it('honours a custom step', () => {
    const seen: number[] = [];
    run((t) => (seen.push(t), []), { stepH: 12 });
    expect(seen).toEqual([NOW, NOW + 12 * H, NOW + 24 * H, NOW + 36 * H]);
  });
});

describe('planOutbox playbook and horizon', () => {
  const fmt: Fmt = { kg: String, mmss: String, muscle: String, exercise: String } as Fmt;
  const base = {
    temper: 3 as const,
    finished: [] as Workout[],
    plays: [] as Play[],
    now: WED_NOON,
    locale: 'en' as const,
    fmt,
    title: 'Atlas',
    reviewBody: 'Week in.',
  };
  const play = {
    id: 'p',
    name: 'Pull day',
    weekdays: [0, 0, 0, 9, 0, 0, 0],
    lastTrainedAt: 1,
  } as unknown as Play;

  it('nudges for a usual (playbook) day with nothing planned, naming it', () => {
    const out = planOutbox({ ...base, coach, plays: [play] });
    const s = out.find((m) => m.id.startsWith('skipped-'))!;
    expect(s.noteId).toMatch(/^skipped:/);
    expect(s.tag).toBe('atlas-skipped');
    // default 18:00 + nudge delay, never later than 21:00
    expect(new Date(s.dueAt).getHours()).toBeLessThanOrEqual(21);
    expect(new Date(s.dueAt).getHours()).toBeGreaterThanOrEqual(19);
  });
  it('drops a nudge whose moment has already passed today', () => {
    const late = new Date(2026, 9, 7, 22).getTime();
    const out = planOutbox({ ...base, now: late, coach, plays: [play] });
    expect(out.some((m) => m.id.startsWith('skipped-'))).toBe(false);
  });
  it('a nudge that falls due exactly now is already too late; a minute earlier it is still planned', () => {
    const first = planOutbox({ ...base, coach, plays: [play] }).find((m) =>
      m.id.startsWith('skipped-'),
    )!;
    const at = (now: number) =>
      planOutbox({ ...base, now, coach, plays: [play] }).filter((m) => m.id === first.id);
    expect(at(first.dueAt)).toHaveLength(0);
    expect(at(first.dueAt - 60_000)).toHaveLength(1);
  });
  it('does not plan a nudge for a day with neither a plan nor a usual play', () => {
    expect(planOutbox({ ...base, coach }).some((m) => m.id.startsWith('skipped-'))).toBe(false);
  });
  it('an extra coach never plans a programme day (plan ignored)', () => {
    const plan = { days: [{ weekday: 3, name: 'X' }] } as never;
    const out = planOutbox({ ...base, coach: { ...coach, role: 'extra', plan } });
    expect(out.some((m) => m.id.startsWith('skipped-'))).toBe(false);
  });
  it('books exactly one review, in the evening of the week end, with the given body', () => {
    const out = planOutbox({ ...base, coach });
    const reviews = out.filter((m) => m.id.startsWith('review-'));
    expect(reviews).toHaveLength(1);
    expect(reviews[0].body).toBe('Week in.');
    expect(new Date(reviews[0].dueAt).getHours()).toBe(REVIEW_H);
    expect(reviews[0].tag).toBe('atlas-review');
    expect(reviews[0].noteId).toBeDefined();
  });
  it('skips a review whose hour has passed on the week-end day itself', () => {
    const sundayNight = new Date(2026, 9, 11, 20).getTime();
    const out = planOutbox({ ...base, now: sundayNight, coach });
    const r = out.find((m) => m.id.startsWith('review-'))!;
    expect(r.dueAt).toBeGreaterThan(sundayNight + 5 * 86_400_000);
  });
});

describe('chatBacked', () => {
  it('keeps pushes without a note, and pushes whose note is in the feed at their moment', () => {
    const a = msg('a');
    const b = msg('b', { noteId: 'n1', dueAt: 5 });
    const c = msg('c', { noteId: 'n2', dueAt: 5 });
    const seenAt: number[] = [];
    const out = chatBacked([a, b, c], (t) => {
      seenAt.push(t);
      return [{ id: 'n1' }];
    });
    expect(out).toEqual([a, b]);
    expect(seenAt).toEqual([5, 5]);
  });
});

describe('syncOutbox', () => {
  it('does nothing when signed out', async () => {
    fs.uid = null;
    await syncOutbox([msg('a')]);
    expect(fs.setDoc).not.toHaveBeenCalled();
    expect(fs.deleteDoc).not.toHaveBeenCalled();
  });
  it('writes new messages under users/{uid}/outbox with only the delivery fields', async () => {
    await syncOutbox([msg('a', { noteId: 'n' })]);
    expect(fs.setDoc).toHaveBeenCalledWith(
      { path: 'users/u1/outbox/a' },
      { dueAt: 1000, title: 'T', body: 'B', tag: 'tag', url: '/u' },
    );
  });
  it('rewrites a changed message but not an identical one', async () => {
    fs.existing = [
      { id: 'same', data: { dueAt: 1000, title: 'T', body: 'B' } },
      { id: 'moved', data: { dueAt: 999, title: 'T', body: 'B' } },
      { id: 'reworded', data: { dueAt: 1000, title: 'T', body: 'old' } },
      { id: 'retitled', data: { dueAt: 1000, title: 'old', body: 'B' } },
    ];
    await syncOutbox(['same', 'moved', 'reworded', 'retitled'].map((i) => msg(i)));
    const written = fs.setDoc.mock.calls.map((c) => c[0].path.split('/').pop()).sort();
    expect(written).toEqual(['moved', 'retitled', 'reworded']);
    expect(fs.deleteDoc).not.toHaveBeenCalled();
  });
  it('deletes stale plan docs but leaves one-off chat replies alone', async () => {
    fs.existing = [
      { id: 'gone', data: {} },
      { id: 'reply-123', data: {} },
      { id: 'kept', data: { dueAt: 1000, title: 'T', body: 'B' } },
    ];
    await syncOutbox([msg('kept')]);
    expect(fs.deleteDoc).toHaveBeenCalledTimes(1);
    expect(fs.deleteDoc).toHaveBeenCalledWith({ path: 'ref/gone' });
  });
});

describe('pushReplyNow', () => {
  it('writes an already-due reply doc keyed by the time', async () => {
    await pushReplyNow('Atlas', 'Short', 777);
    expect(fs.setDoc).toHaveBeenCalledWith(
      { path: 'users/u1/outbox/reply-777' },
      { dueAt: 777, title: 'Atlas', body: 'Short', tag: 'atlas-reply', url: '/#/coach' },
    );
  });
  it('keeps a 300-character body whole, trims a longer one to 297 + ellipsis', async () => {
    await pushReplyNow('A', 'x'.repeat(300), 1);
    expect(fs.setDoc.mock.calls[0][1].body).toBe('x'.repeat(300));
    await pushReplyNow('A', `${'x'.repeat(296)} ${'y'.repeat(10)}`, 2);
    expect(fs.setDoc.mock.calls[1][1].body).toBe(`${'x'.repeat(296)}…`);
  });
  it('does nothing when signed out', async () => {
    fs.uid = null;
    await pushReplyNow('A', 'B', 1);
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});
