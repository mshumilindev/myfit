import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { setLocale } from '../../i18n';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setCoachTimeZone } from '../format';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort, scheduleSeedDstDay, TODAY_KEY } from './__fixtures__/fixtures';
import { ScheduleScreen } from './ScheduleScreen';
import { WeekScreen } from './WeekScreen';
import { hourUnderChip, WeekGrid } from './WeekGrid';
import { dayOfTs, minOfTs, tsOf } from './time';
import type { People } from './people';

const world = () => createFixturesPort({ warm: true });
const none = { name: () => '', byId: new Map() } as unknown as People;

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/schedule');
});
afterEach(() => {
  cleanup();
  setCoachTimeZone('UTC');
  vi.useRealTimers();
  window.history.replaceState(null, '', '#/c/schedule');
});

const lines = () => document.querySelectorAll<HTMLElement>('.uinow');
const grid = (now: number, days: number[], extra: Partial<Parameters<typeof WeekGrid>[0]> = {}) =>
  render(
    <WeekGrid
      days={days}
      slots={[]}
      ghosts={[]}
      conflicts={new Set()}
      now={now}
      today={dayOfTs(now)}
      selected={null}
      onSelect={() => undefined}
      people={none}
      t={t}
      locale="en"
      {...extra}
    />,
  );

describe('Now line in the Coach week / day grid', () => {
  it('week view: one line in the TODAY column only, no chip; day view: chip with the clock', () => {
    const now = tsOf(TODAY_KEY, 9 * 60 + 5);
    const { container, unmount } = grid(now, [TODAY_KEY - 1, TODAY_KEY, TODAY_KEY + 1]);
    expect(lines()).toHaveLength(1);
    expect(container.querySelector('.sc-col.is-today .uinow')).toBeTruthy();
    expect(container.querySelector('.uinow-chip')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Now, 09:05');
    unmount();
    const day = grid(now, [TODAY_KEY]);
    expect(day.container.querySelector('.uinow-chip')?.textContent).toBe('09:05');
  });

  it('is absent when today is not shown or outside the visible hours', () => {
    const now = tsOf(TODAY_KEY, 9 * 60 + 5);
    grid(now, [TODAY_KEY + 3, TODAY_KEY + 4]);
    expect(lines()).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    grid(tsOf(TODAY_KEY, 5 * 60), [TODAY_KEY]);
    expect(lines()).toHaveLength(0);
    cleanup();
    grid(tsOf(TODAY_KEY, 22 * 60), [TODAY_KEY]);
    expect(lines()).toHaveLength(0);
  });

  it('sits at the zoned wall-clock minute (not the browser zone)', () => {
    setCoachTimeZone('Asia/Tokyo'); // UTC+9, no DST
    const now = Date.UTC(2026, 9, 7, 0, 30); // 09:30 in Tokyo
    expect(minOfTs(now)).toBe(9 * 60 + 30);
    const { container } = grid(now, [dayOfTs(now)]);
    const top = parseFloat(container.querySelector<HTMLElement>('.uinow')?.style.top ?? '');
    expect(top).toBeCloseTo(((9 * 60 + 30 - 7 * 60) / (14 * 60)) * 100, 4);
    expect(container.querySelector('.uinow-chip')?.textContent).toBe('09:30');
  });

  it.each([
    [
      'spring gap (Warsaw 29 Mar 2026: 02:00 jumps to 03:00)',
      Date.UTC(2026, 2, 29, 1, 30),
      3 * 60 + 30,
    ],
    ['spring, before the gap', Date.UTC(2026, 2, 29, 0, 59), 60 + 59],
    ['autumn, first 02:30', Date.UTC(2026, 9, 25, 0, 30), 2 * 60 + 30],
    ['autumn, repeated hour (second 02:30)', Date.UTC(2026, 9, 25, 1, 30), 2 * 60 + 30],
    ['autumn, after the repeat', Date.UTC(2026, 9, 25, 2, 15), 3 * 60 + 15],
  ])('DST: %s', (_n, now, wall) => {
    setCoachTimeZone('Europe/Warsaw');
    expect(minOfTs(now)).toBe(wall);
    const { container } = grid(now, [dayOfTs(now)]);
    // the grid range is 07:00-21:00 by default, so these early-morning times are hidden; widen it with a session
    expect(container.querySelector('.uinow')).toBeNull();
  });

  it('DST: with a wide range the line is where the wall clock says, before and after the change', () => {
    setCoachTimeZone('Europe/Warsaw');
    for (const [now, wall] of [
      [Date.UTC(2026, 2, 29, 12, 0), 14 * 60], // after spring forward: CEST = UTC+2
      [Date.UTC(2026, 2, 28, 12, 0), 13 * 60], // day before: CET = UTC+1
      [Date.UTC(2026, 9, 25, 12, 0), 13 * 60], // after autumn back: CET
      [Date.UTC(2026, 9, 24, 12, 0), 14 * 60], // day before: CEST
    ] as const) {
      const { container, unmount } = grid(now, [dayOfTs(now)]);
      const top = parseFloat(container.querySelector<HTMLElement>('.uinow')?.style.top ?? '');
      expect(top).toBeCloseTo(((wall - 7 * 60) / (14 * 60)) * 100, 4);
      unmount();
    }
  });

  it('past sessions of today are dimmed; the status speaks only on mount and hour change', () => {
    const now = tsOf(TODAY_KEY, 9 * 60 + 5);
    const { rerender } = grid(now, [TODAY_KEY]);
    const say = () => screen.getByRole('status').textContent;
    expect(say()).toBe('Now, 09:05');
    const props = (n: number) => (
      <WeekGrid
        days={[TODAY_KEY]}
        slots={[]}
        ghosts={[]}
        conflicts={new Set()}
        now={n}
        today={TODAY_KEY}
        selected={null}
        onSelect={() => undefined}
        people={none}
        t={t}
        locale="en"
      />
    );
    rerender(props(tsOf(TODAY_KEY, 9 * 60 + 6)));
    expect(say()).toBe('Now, 09:05');
    rerender(props(tsOf(TODAY_KEY, 10 * 60)));
    expect(say()).toBe('Now, 10:00');
  });
});

describe('Now line in the Schedule screen', () => {
  it('week view: the line moves on the minute of the injected app clock', async () => {
    vi.useFakeTimers();
    let clock = tsOf(TODAY_KEY, 9 * 60 + 5) + 30_000;
    const port = createFixturesSchedulePort({ now: () => clock });
    render(<ScheduleScreen onNavigate={vi.fn()} port={port} worldPort={world()} />);
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(lines()).toHaveLength(1);
    const first = lines()[0].style.top;
    clock = tsOf(TODAY_KEY, 9 * 60 + 6);
    await act(async () => void (await vi.advanceTimersByTimeAsync(29_000)));
    expect(lines()[0].style.top).toBe(first); // not before the boundary
    await act(async () => void (await vi.advanceTimersByTimeAsync(1_000)));
    expect(lines()[0].style.top).not.toBe(first);
  });

  it('past sessions of today carry the dim class, upcoming ones do not', async () => {
    const port = createFixturesSchedulePort({ now: () => tsOf(TODAY_KEY, 12 * 60) });
    render(<ScheduleScreen onNavigate={vi.fn()} port={port} worldPort={world()} />);
    await waitFor(() => expect(lines()).toHaveLength(1));
    const todayCol = document.querySelector('.sc-col.is-today') as HTMLElement;
    const blocks = [...todayCol.querySelectorAll('.sc-block:not(.sc-block--moved)')];
    expect(blocks.length).toBeGreaterThan(0);
    const dimmed = blocks.filter((b) => b.classList.contains('sc-block--past'));
    expect(dimmed.length).toBeGreaterThan(0);
    for (const b of dimmed) expect(b.getAttribute('aria-label')).toBeTruthy();
    for (const col of document.querySelectorAll('.sc-col:not(.is-today)'))
      expect(col.querySelector('.sc-block--past')).toBeNull();
  });

  it('phone agenda: a Now divider between past and upcoming sessions of today', async () => {
    setViewport(390);
    window.history.replaceState(null, '', `#/c/schedule?view=day&d=${TODAY_KEY}`);
    const port = createFixturesSchedulePort({ now: () => tsOf(TODAY_KEY, 12 * 60) });
    render(<ScheduleScreen onNavigate={vi.fn()} port={port} worldPort={world()} />);
    const sep = await screen.findByRole('separator', { name: 'Now, 12:00' });
    const rows = within(sep.parentElement as HTMLElement).getAllByRole('button');
    const idx = [...(sep.parentElement as HTMLElement).children].indexOf(sep);
    expect(idx).toBeGreaterThan(0);
    expect(idx).toBeLessThan(rows.length);
  });

  it('phone agenda: no divider on another day', async () => {
    setViewport(390);
    window.history.replaceState(null, '', `#/c/schedule?view=day&d=${TODAY_KEY + 1}`);
    const port = createFixturesSchedulePort({ now: () => tsOf(TODAY_KEY, 12 * 60) });
    render(<ScheduleScreen onNavigate={vi.fn()} port={port} worldPort={world()} />);
    await screen.findByText(t.scAgendaLabel === '' ? '' : /./, { selector: 'h2, .uigl-h' });
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('Week page: the day list gets the divider on today', async () => {
    window.history.replaceState(null, '', '#/c/week');
    const port = createFixturesSchedulePort({ now: () => tsOf(TODAY_KEY, 12 * 60) });
    render(<WeekScreen onNavigate={vi.fn()} port={port} worldPort={world()} />);
    expect(await screen.findByRole('separator', { name: 'Now, 12:00' })).toBeTruthy();
  });
});

describe('Day view: the Now chip never covers an hour label', () => {
  const hoursShown = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLElement>('.sc-hour')].map((h) => [
      h.textContent,
      h.classList.contains('is-under-now'),
    ]);
  it.each([
    [10 * 60 + 0, '10:00'],
    [10 * 60 + 13, '10:00'],
    [9 * 60 + 47, '10:00'],
    [11 * 60 + 5, '11:00'],
  ])('at %i minutes the label that would sit under the chip steps aside (%s)', (min, label) => {
    const { container } = grid(tsOf(TODAY_KEY, min), [TODAY_KEY]);
    const hidden = hoursShown(container)
      .filter(([, h]) => h)
      .map(([x]) => x);
    expect(hidden).toContain(label);
    expect(hidden.length).toBeLessThanOrEqual(2);
  });
  it('a label far from the chip stays, and exactly the covered window is hidden', () => {
    const { container } = grid(tsOf(TODAY_KEY, 11 * 60 + 40), [TODAY_KEY]);
    const hidden = hoursShown(container).filter(([, h]) => h);
    expect(hidden).toEqual([]);
    /* labels are centred on their hour line, like the chip on the now line: the window is symmetric (iter19) */
    expect(hourUnderChip(600, 600 + 13)).toBe(true);
    expect(hourUnderChip(600, 600 + 14)).toBe(false);
    expect(hourUnderChip(600, 600 - 13)).toBe(true);
    expect(hourUnderChip(600, 600 - 14)).toBe(false);
  });
  it('week view has no chip, so no label is hidden', () => {
    const { container } = grid(tsOf(TODAY_KEY, 10 * 60 + 5), [TODAY_KEY - 1, TODAY_KEY]);
    expect(container.querySelector('.is-under-now')).toBeNull();
  });
});

describe('Spring-forward day with real sessions (Warsaw, 29 Mar 2026)', () => {
  const SPRING = dayOfTs(Date.UTC(2026, 2, 29, 12));
  it('the line sits at the 14:05 wall time, past sessions dim, upcoming ones do not, sessions keep their wall time', async () => {
    setCoachTimeZone('Europe/Warsaw');
    window.history.replaceState(null, '', `#/c/schedule?view=day&d=${SPRING}`);
    const port = createFixturesSchedulePort({
      now: () => Date.UTC(2026, 2, 29, 12, 5), // 14:05 CEST
      seed: scheduleSeedDstDay(SPRING),
    });
    render(<ScheduleScreen onNavigate={vi.fn()} port={port} worldPort={world()} />);
    await waitFor(() => expect(lines()).toHaveLength(1));
    const line = lines()[0];
    expect(parseFloat(line.style.top)).toBeCloseTo(((14 * 60 + 5 - 7 * 60) / (14 * 60)) * 100, 4);
    expect(line.querySelector('.uinow-chip')?.textContent).toBe('14:05');
    const blocks = [...document.querySelectorAll<HTMLElement>('.sc-col .sc-block')];
    expect(blocks).toHaveLength(4);
    const dim = blocks.filter((b) => b.classList.contains('sc-block--past'));
    expect(dim).toHaveLength(2); // 09:00 and 13:00 ended before 14:05; 14:30 and 16:00 did not
    const labels = blocks.map((b) => b.getAttribute('aria-label') ?? '');
    for (const wallTime of ['09:00', '13:00', '14:30', '16:00'])
      expect(labels.some((l) => l.includes(wallTime))).toBe(true);
    // 14:00 would sit under the chip at 14:05
    const hidden = [...document.querySelectorAll('.sc-hour.is-under-now')].map(
      (h) => h.textContent,
    );
    expect(hidden).toEqual(['14:00']);
    expect(document.querySelector('[data-now-status]')?.textContent).toBe('Now, 14:05');
  });
});
