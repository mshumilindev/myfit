import { describe, expect, it } from 'vitest';
import { legendKeyOf } from './legend';
import { cardStateOf, isLive, liveProgress, minutesLeft, nowDividerIndex } from './status';
import type { ScheduleSlot } from './types';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 7, 15, 0); // a start; "now" is moved around it
const slot = (
  startMin: number,
  dur: number,
  status: ScheduleSlot['status'] = 'planned',
): ScheduleSlot =>
  ({
    start: T0 + startMin * MIN,
    durationMin: dur,
    status,
    attendees: [],
    clientId: 'c1',
  }) as unknown as ScheduleSlot;

describe('card state', () => {
  const s = slot(0, 60);
  it('planned before the start, in progress inside, done after the end', () => {
    expect(cardStateOf(s, T0 - MIN)).toBe('planned');
    expect(cardStateOf(s, T0)).toBe('inprogress'); // the start itself is inside
    expect(cardStateOf(s, T0 + 59 * MIN)).toBe('inprogress');
    expect(cardStateOf(s, T0 + 60 * MIN)).toBe('done'); // the end itself is already past
    expect(cardStateOf(s, T0 + 61 * MIN)).toBe('done');
  });
  it('a mark wins over the clock', () => {
    expect(cardStateOf(slot(0, 60, 'missed'), T0 + 10 * MIN)).toBe('missed');
    expect(cardStateOf(slot(0, 60, 'done'), T0 + 10 * MIN)).toBe('done');
  });
  it('a pending move runs like a planned session; moved-away and ghosts are proposed', () => {
    expect(cardStateOf(slot(0, 60, 'pending-move'), T0 + 10 * MIN)).toBe('inprogress');
    expect(cardStateOf(slot(0, 60, 'moved'), T0 + 10 * MIN)).toBe('proposed');
    expect(cardStateOf(s, T0 - 5 * MIN, true)).toBe('proposed');
  });
  it('the legend key follows the card state when the clock is given', () => {
    expect(legendKeyOf(s, false, T0 + MIN)).toBe('inprogress');
    expect(legendKeyOf(s, false)).toBe('planned');
    expect(legendKeyOf(s, true, T0 + MIN)).toBe('proposed');
  });
  it('isLive, progress and minutes left', () => {
    expect(isLive(s, T0 + 30 * MIN)).toBe(true);
    expect(isLive(slot(0, 60, 'done'), T0 + 30 * MIN)).toBe(false);
    expect(liveProgress(s, T0 + 15 * MIN)).toBeCloseTo(0.25);
    expect(liveProgress(s, T0 - 15 * MIN)).toBe(0);
    expect(minutesLeft(s, T0 + 50 * MIN)).toBe(10);
    expect(minutesLeft(s, T0 + 59.9 * MIN)).toBe(1);
  });
});

describe('Now divider position (a day list sorted by start)', () => {
  const list = [slot(-300, 45), slot(0, 60), slot(120, 60)]; // 10:00, 15:00, 17:00
  it('before the first session', () => {
    expect(nowDividerIndex(list, T0 - 400 * MIN)).toBe(0);
  });
  it('between sessions: after the one that ended, before the next', () => {
    expect(nowDividerIndex(list, T0 - 100 * MIN)).toBe(1);
  });
  it('inside a session: the running session is above the divider (the reported bug)', () => {
    expect(nowDividerIndex(list, T0 + 30 * MIN)).toBe(2);
  });
  it('after the last session started, the divider closes the list', () => {
    expect(nowDividerIndex(list, T0 + 130 * MIN)).toBe(3);
    expect(nowDividerIndex(list, T0 + 600 * MIN)).toBe(3);
  });
  it('a session that starts exactly now is above the divider (it has started)', () => {
    expect(nowDividerIndex(list, T0)).toBe(2);
  });
  it('overlapping sessions: only each start counts', () => {
    const o = [slot(0, 90), slot(30, 60), slot(45, 30)];
    expect(nowDividerIndex(o, T0 + 40 * MIN)).toBe(2);
    expect(nowDividerIndex(o, T0 + 50 * MIN)).toBe(3);
    expect(nowDividerIndex(o, T0 - MIN)).toBe(0);
  });
  it('an empty day', () => {
    expect(nowDividerIndex([], T0)).toBe(0);
  });
  it('another day (multi-day boundary): a list of a later day sits wholly below, an earlier one above', () => {
    const tomorrow = [slot(24 * 60, 60)];
    const yesterday = [slot(-24 * 60, 60)];
    expect(nowDividerIndex(tomorrow, T0)).toBe(0);
    expect(nowDividerIndex(yesterday, T0)).toBe(1);
  });
});
