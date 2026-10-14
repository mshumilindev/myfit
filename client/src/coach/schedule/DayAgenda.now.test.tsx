import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import type { CoachClient } from '../domain/types';
import { setCoachTimeZone } from '../format';
import { DayAgenda } from './DayAgenda';
import type { People } from './people';
import type { ScheduleSlot } from './types';
import { tsOf, weekStartDay } from './time';

const DAY = 20_000;
const mon = weekStartDay(DAY);
const days = Array.from({ length: 7 }, (_, i) => mon + i);

const people: People = {
  list: [] as CoachClient[],
  byId: new Map(),
  name: (id) => `P-${id}`,
  first: (id) => `P-${id}`,
  loading: false,
};

const slot = (id: string, day: number, h: number, durMin = 60): ScheduleSlot =>
  ({
    id,
    key: id,
    clientId: id,
    kind: 'solo',
    attendees: [{ clientId: id }],
    start: tsOf(day, h * 60),
    durationMin: durMin,
    gymId: 'g1',
    status: 'planned',
  }) as unknown as ScheduleSlot;

function mount(slots: ScheduleSlot[], now: number, day = DAY) {
  const { container } = render(
    <DayAgenda
      days={days}
      day={day}
      onDay={() => undefined}
      slots={slots}
      conflicts={new Set()}
      selected={null}
      onSelect={() => undefined}
      people={people}
      t={t}
      locale="en"
      today={DAY}
      now={now}
    />,
  );
  /* order of rows and the divider in the document */
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>('.uirow, .uinow, [data-now-divider]'),
  );
  return nodes.map((n) => n.textContent ?? '');
}

const order = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.uigl-rows > *')).map(
    (n) => n.textContent ?? '',
  );

beforeEach(() => {
  setLocale('en');
  setCoachTimeZone('UTC');
});
afterEach(() => {
  cleanup();
  setCoachTimeZone('UTC');
});

const idx = (rows: string[], needle: string | RegExp) =>
  rows.findIndex((r) => (typeof needle === 'string' ? r.includes(needle) : needle.test(r)));

describe('DayAgenda now divider', () => {
  const a = () => slot('a', DAY, 10);
  const b = () => slot('b', DAY, 18);

  it('now inside a session: the divider sits after the running session, which says In progress', () => {
    mount([a(), b()], tsOf(DAY, 18 * 60 + 49));
    const rows = order();
    expect(idx(rows, t.scNow)).toBeGreaterThan(idx(rows, 'P-b'));
    expect(idx(rows, 'P-a')).toBeLessThan(idx(rows, 'P-b'));
    expect(screen.getAllByText(t.scInProgress).length).toBeGreaterThan(0);
  });

  it('between sessions: divider between them', () => {
    mount([a(), b()], tsOf(DAY, 14 * 60));
    const rows = order();
    expect(idx(rows, 'P-a')).toBeLessThan(idx(rows, t.scNow));
    expect(idx(rows, t.scNow)).toBeLessThan(idx(rows, 'P-b'));
    expect(screen.queryByText(t.scInProgress)).toBeNull();
  });

  it('before the first session: divider on top', () => {
    mount([a(), b()], tsOf(DAY, 6 * 60));
    const rows = order();
    expect(idx(rows, t.scNow)).toBeLessThan(idx(rows, 'P-a'));
  });

  it('after the last session: divider at the bottom', () => {
    mount([a(), b()], tsOf(DAY, 22 * 60));
    const rows = order();
    expect(idx(rows, t.scNow)).toBeGreaterThan(idx(rows, 'P-b'));
  });

  it('overlapping sessions: both started, both above the divider', () => {
    mount([slot('x', DAY, 10, 120), slot('y', DAY, 11, 60)], tsOf(DAY, 11 * 60 + 30));
    const rows = order();
    expect(idx(rows, t.scNow)).toBeGreaterThan(idx(rows, 'P-y'));
    expect(screen.getAllByText(t.scInProgress)).toHaveLength(2);
  });

  it('no divider on another day (multi-day boundary)', () => {
    mount([slot('n', DAY + 1, 9)], tsOf(DAY, 23 * 60 + 59), DAY + 1);
    expect(screen.queryByText(t.scNow)).toBeNull();
  });

  it('timezone: the same instant is "after" in Kyiv but "inside" in UTC', () => {
    /* session 18:00-19:00 Kyiv wall time; now = 17:30 UTC = 20:30 Kyiv (summer) */
    setCoachTimeZone('Europe/Kyiv');
    const k = slot('k', DAY, 18);
    const nowKyiv = tsOf(DAY, 18 * 60 + 30);
    mount([k], nowKyiv);
    const rows = order();
    expect(idx(rows, t.scNow)).toBeGreaterThan(idx(rows, 'P-k'));
    expect(screen.getAllByText(t.scInProgress).length).toBeGreaterThan(0);
  });
});
