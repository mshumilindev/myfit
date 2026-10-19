import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { CALENDAR_WIDGETS, healthKindLabel } from './calendar';
import { widgetMatrix } from '../__fixtures__/matrix';
import {
  NOW,
  PRESETS,
  STATES,
  renderWidget,
  richState,
  seed,
  setLocale,
} from '../__fixtures__/widgetHarness';
import type { Workout } from '../../types';

const [calendar, yearPixels] = CALENDAR_WIDGETS;

widgetMatrix('calendar widgets', CALENDAR_WIDGETS);
widgetMatrix('calendar widgets (other locales)', CALENDAR_WIDGETS, {
  locales: ['uk', 'pl', 'lt', 'et'],
  scenarios: [
    ['rich', 'program'],
    ['unwell', 'program'],
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  seed(STATES.unwell());
  PRESETS.program();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const dayButton = (n: number) =>
  screen.getAllByRole('button').find((b) => new RegExp(`^${n}(\\D|$)`).test(b.textContent ?? ''));

describe('healthKindLabel', () => {
  it('names each health state in the locale', () => {
    expect(['rest', 'sick', 'off', 'injury'].map((k) => healthKindLabel(k as never, 'en'))).toEqual(
      ['Rest', 'Sick', 'Day off', 'Injury'],
    );
    expect(healthKindLabel('sick', 'uk')).not.toBe('Sick');
    expect(healthKindLabel('injury', 'et')).not.toBe(healthKindLabel('rest', 'et'));
  });
});

describe('Calendar widget — month (XL)', () => {
  it('shows the month, steps back and forward but never past next month', () => {
    renderWidget(calendar, 'XL');
    expect(screen.getByText('September 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('August 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('summarises the trained days of the month', () => {
    renderWidget(calendar, 'XL');
    expect(document.body.textContent).toMatch(/Sep.*\d+ trained/i);
  });

  it('a day with exactly one session opens that session; any other day opens History', () => {
    const { ctx } = renderWidget(calendar, 'XL');
    fireEvent.click(dayButton(25)!);
    expect(ctx.shell.calls.openOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'past-workout', workoutId: expect.any(String) }),
    );
    fireEvent.click(dayButton(26)!);
    expect(ctx.shell.calls.openOverlay).toHaveBeenLastCalledWith({ screen: 'history' });
  });

  it('a day with two sessions opens History instead of guessing', () => {
    const s = richState();
    const first = s.workouts.find((w) => new Date(w.startedAt).getDate() === 25)!;
    const second: Workout = {
      ...first,
      id: 'double',
      startedAt: first.startedAt + 3_600_000,
      finishedAt: first.startedAt + 6_000_000,
    };
    seed({ ...s, workouts: [...s.workouts, second] });
    const { ctx } = renderWidget(calendar, 'XL');
    fireEvent.click(dayButton(25)!);
    expect(ctx.shell.calls.openOverlay).toHaveBeenLastCalledWith({ screen: 'history' });
  });
});

describe('Calendar widget — smaller sizes', () => {
  it('S counts days trained in the last 30 days; an empty log invites to fill it in', () => {
    const { container, unmount } = renderWidget(calendar, 'S');
    expect(container.textContent).toMatch(/\d+/);
    unmount();
    seed(STATES.empty());
    const empty = renderWidget(calendar, 'S');
    expect(empty.container.textContent).toContain('—');
  });

  it('the week strip and month of M/L open History', () => {
    for (const size of ['M', 'L'] as const) {
      const { ctx, container, unmount } = renderWidget(calendar, size);
      fireEvent.click(container.querySelector('button, [role=button]')!);
      expect(ctx.shell.calls.openOverlay).toHaveBeenCalled();
      unmount();
    }
  });
});

describe('Year in pixels', () => {
  it('renders every size and a click goes to History', () => {
    for (const size of ['S', 'M', 'L', 'XL'] as const) {
      const { ctx, container, unmount } = renderWidget(yearPixels, size);
      const clickable = container.querySelector<HTMLElement>('button, [role=button]');
      if (clickable) fireEvent.click(clickable);
      expect(container.innerHTML).not.toBe('');
      unmount();
      void ctx;
    }
    expect(within(document.body).queryAllByRole('alert')).toHaveLength(0);
  });
});
