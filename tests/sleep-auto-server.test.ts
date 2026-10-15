import { describe, expect, it } from 'vitest';
import {
  AUTO_START_STALE_MS,
  FALLBACK_NIGHT_MS,
  HOUR_MS,
  MAX_OPEN_NIGHT_MS,
  takeDueSlot,
  wakeToCloseAt,
  type UpcomingNight,
} from '../functions/src/sleepAuto';
import { computeUpcomingNights } from '../client/src/sleep';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const night = (startAt: number): UpcomingNight => ({
  startAt,
  wakeAt: startAt + 8 * HOUR_MS,
  date: 'x',
});

describe('server: closing open nights', () => {
  it('keeps a night running until its scheduled wake', () => {
    expect(wakeToCloseAt({ bedtime: at(16, 23), autoWakeAt: at(17, 7) }, at(17, 6))).toBeNull();
  });
  it('closes at the scheduled wake (not at the later job time) once it has passed', () => {
    expect(wakeToCloseAt({ bedtime: at(16, 23), autoWakeAt: at(17, 7) }, at(17, 8))).toBe(
      at(17, 7),
    );
  });
  it('never closes before the night is a minute old', () => {
    expect(wakeToCloseAt({ bedtime: 1000, autoWakeAt: 500 }, 5000)).toBe(61_000);
  });
  it('closes a hand-started night (no scheduled wake) that was left open > 16 h', () => {
    const bed = at(16, 23);
    expect(wakeToCloseAt({ bedtime: bed }, bed + MAX_OPEN_NIGHT_MS - 1)).toBeNull();
    expect(wakeToCloseAt({ bedtime: bed }, bed + MAX_OPEN_NIGHT_MS + 1)).toBe(
      bed + FALLBACK_NIGHT_MS,
    );
  });
  it('ignores malformed docs', () => {
    expect(wakeToCloseAt({}, Date.now())).toBeNull();
  });
});

describe('server: start queue', () => {
  it('acts on the most recent due slot and keeps the future ones', () => {
    const now = at(16, 23, 40);
    const { slot, rest } = takeDueSlot(
      [night(at(18, 23, 30)), night(at(16, 23, 30)), night(at(17, 23, 30))],
      now,
    );
    expect(slot?.startAt).toBe(at(16, 23, 30));
    expect(rest.map((n) => n.startAt)).toEqual([at(17, 23, 30), at(18, 23, 30)]);
  });
  it('does not resurrect a stale slot but still drops it from the queue', () => {
    const start = at(16, 23, 30);
    const { slot, rest } = takeDueSlot(
      [night(start), night(start + 24 * HOUR_MS)],
      start + AUTO_START_STALE_MS + 1,
    );
    expect(slot).toBeNull();
    expect(rest).toHaveLength(1);
  });
  it('nothing due leaves the queue untouched', () => {
    const { slot, rest } = takeDueSlot([night(at(20, 23))], at(16, 12));
    expect(slot).toBeNull();
    expect(rest).toHaveLength(1);
  });
});

describe('full cycle: evening -> night -> morning (app closed)', () => {
  it('client queue -> server opens the night at bedtime -> server closes it at the wake time', () => {
    const schedule = {
      sameEveryNight: true,
      every: { bedMin: 23 * 60 + 30, wakeMin: 7 * 60 },
      byDay: {},
    };
    // 1. Evening, app open: the client lays out the queue.
    const queue = computeUpcomingNights(schedule, [], at(16, 20), 14);
    expect(queue[0].startAt).toBe(at(16, 23, 30));
    expect(queue[0].wakeAt).toBe(at(17, 7));
    // 2. Hourly job at 23:50 (app closed): the first slot is due and is opened.
    const evening = takeDueSlot(queue, at(16, 23, 50));
    expect(evening.slot?.startAt).toBe(at(16, 23, 30));
    expect(evening.slot?.date).toBe('2026-10-17');
    const opened = { bedtime: evening.slot!.startAt, autoWakeAt: evening.slot!.wakeAt };
    // 3. Jobs through the night leave it running; the first job after 07:00 closes it at 07:00 sharp.
    expect(wakeToCloseAt(opened, at(17, 3))).toBeNull();
    expect(wakeToCloseAt(opened, at(17, 7, 40))).toBe(at(17, 7));
    // 4. The next evening's slot is still queued.
    expect(evening.rest[0].startAt).toBe(at(17, 23, 30));
  });
});
