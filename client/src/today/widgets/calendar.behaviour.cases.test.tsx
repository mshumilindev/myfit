import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { CALENDAR_WIDGETS } from './calendar';
import { NOW, PRESETS, STATES, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => CALENDAR_WIDGETS.find((w) => w.id === id)!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  PRESETS.none();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Row = [state: string, id: string, size: WidgetSize, parts: string[]];

describe('calendar widgets report the logged history', () => {
  it.each([
    ['rich', 'calendar', 'S', ['Last 30 days', '13', 'days trained', '13 PRs']],
    ['unwell', 'calendar', 'S', ['3 sick', '13 PRs']],
    [
      'empty',
      'calendar',
      'S',
      ['Last 30 days', '—', 'Log a workout, activity or sleep to fill it'],
    ],
    ['rich', 'calendar', 'M', ['3 trained this week']],
    ['empty', 'calendar', 'M', ['0 trained this week']],
    ['rich', 'calendar', 'L', ['Sep 14 – Sep 27', '13 logged · 6 PRs']],
    ['empty', 'calendar', 'L', ['Sep 14 – Sep 27', 'Nothing logged yet']],
    ['rich', 'calendar', 'XL', ['September 2026', 'Sep: 11 trained · 47.8 t']],
    ['empty', 'calendar', 'XL', ['Sep: 0 trained · 0.0 t']],
    ['rich', 'year-pixels', 'S', ['2026 in pixels', '46', 'logged · 30 trained']],
    ['unwell', 'year-pixels', 'M', ['46 days logged', '30 trained', '2 sick']],
    ['rich', 'year-pixels', 'L', ['46 logged of 269']],
    [
      'rich',
      'year-pixels',
      'XL',
      ['longest streak 28', 'logged · 17%', 'Trained30', 'Activity only8', 'Sick0'],
    ],
    ['unwell', 'year-pixels', 'XL', ['Sick2', 'Day off0']],
    ['empty', 'year-pixels', 'XL', ['Trained0', 'Log a workout, activity or sleep to fill it']],
    ['empty', 'year-pixels', 'S', ['Nothing logged yet']],
  ] as Row[])('%s %s %s', (state, id, size, parts) => {
    seed(STATES[state]());
    PRESETS.program();
    const r = renderWidget(byId(id), size);
    const out = r.container.textContent ?? '';
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('month grid marks', () => {
  const dayCell = (n: number) =>
    screen
      .getAllByRole('button')
      .find((b) => new RegExp(`^${n}(\\D|$)`).test(b.textContent ?? ''))!;

  it('a trained day carries the workout mark; a day with no session does not', () => {
    seed(STATES.rich());
    PRESETS.program();
    renderWidget(byId('calendar'), 'XL');
    expect(dayCell(25).innerHTML).toContain('uit--accent');
    expect(dayCell(24).innerHTML).not.toContain('uit--accent');
  });

  it('an empty log has no workout marks on any day', () => {
    seed(STATES.empty());
    PRESETS.none();
    renderWidget(byId('calendar'), 'XL');
    for (const n of [1, 15, 26]) expect(dayCell(n).innerHTML).not.toContain('uit--accent');
  });
});
