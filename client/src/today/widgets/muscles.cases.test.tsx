import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { MUSCLES_WIDGETS } from './muscles';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => MUSCLES_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('muscles widgets', MUSCLES_WIDGETS);
widgetMatrix('muscles widgets (other locales)', MUSCLES_WIDGETS, {
  locales: ['uk', 'pl', 'lt', 'et'],
  scenarios: [
    ['rich', 'program'],
    ['rich', 'local'],
    ['empty', 'none'],
  ],
});

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

describe('muscles: what each widget reports for the rich fixture history', () => {
  it.each([
    ['muscle-map', 'M', ['Lats leads · 6 sets', '18 sets in 7 days', 'Triceps only 1']],
    ['muscle-map', 'XL', ['Most Lats 6 · least Triceps 1', 'Details']],
    ['volume-landmarks', 'M', ['Shoulders under MEV · 3.5 sets', '0 of 8 muscles in range']],
    ['volume-landmarks', 'XL', ['Shoulders is under MEV — add ~7 sets this week.', 'Open volume']],
    ['stimulus-left', 'M', ['No muscles planned today']],
    ['lr-balance', 'M', ['No side test yet']],
    ['lr-balance', 'XL', ['Left / right balance', 'Test a lift']],
    ['muscle-of-week', 'M', ['Focus: Biceps', '4 of 12 sets', '8 to go by Sun']],
    ['muscle-of-week', 'XL', ['MEV 6 · MAV 12 · MRV 20', 'Pullups', 'Open muscle']],
    ['muscle-frequency', 'M', ['2 of 8 muscles hit 2×', 'Chest only 1× this week']],
    ['muscle-frequency', 'XL', ['target 2× per muscle', 'Open volume']],
    ['ppl-split', 'M', ['Pull-heavy · 33 / 50 / 17', 'Pull 15% above target']],
    ['ppl-split', 'XL', ['72 sets', 'Legs', '12 · target 30%']],
    ['consistency-heatmap', 'M', ['10-week streak', '30 sessions in 16 weeks', 'Best 10']],
    ['consistency-heatmap', 'XL', ['Training days · 52 weeks', 'Longest', 'In 2026']],
    ['weekly-goal', 'M', ['Weekly goal · 3 of 3', 'Goal reached']],
    [
      'weekly-goal',
      'XL',
      ['9-week goal streak', 'Last 6 weeks: 3 · 3 · 3 · 3 · 3 · 3', 'Edit goal'],
    ],
    ['sessions-month', 'M', ['11 sessions in September', 'vs 13 in August']],
    ['sessions-month', 'XL', ['10.6 h total', 'Sep 22 – Sep 30']],
    ['best-training-time', 'M', ['Strongest: Fri evening', '18–22']],
    ['best-training-time', 'XL', ['Values = % vs your average top set · 30 sessions']],
    ['back-on-track', 'M', ['On track', 'Trained today']],
    ['back-on-track', 'XL', ['6 sessions in 14 days', 'no break to ease back from']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('muscles: empty history', () => {
  it.each(MUSCLES_WIDGETS.map((w) => [w.id] as const))(
    '%s renders readable text without NaN or undefined',
    (id) => {
      seed(STATES.empty());
      for (const size of ['S', 'M', 'L', 'XL'] as const) {
        const out = textOf(id, size);
        expect(out.length).toBeGreaterThan(0);
        expect(out).not.toMatch(/NaN|undefined|Infinity/);
        cleanup();
      }
    },
  );

  it('every widget exposes a tappable card or a button', () => {
    seed(STATES.rich());
    PRESETS.program();
    for (const w of MUSCLES_WIDGETS) {
      const r = renderWidget(w, 'M');
      expect(r.container.querySelector('button, [role=button], a')).not.toBeNull();
      cleanup();
    }
  });
});

describe('muscles: interaction and device-local state', () => {
  const tap = (container: HTMLElement, name: string | RegExp) =>
    fireEvent.click(within(container).getAllByRole('button', { name })[0]);
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('weekly goal: the goal saved on this device changes the target', () => {
    localStorage.setItem('spotter.tw.weekly-goal', '5');
    const out = textOf('weekly-goal', 'M');
    expect(out).toContain('3 of 5');
  });

  it('weekly goal: Edit goal opens a sheet', () => {
    const r = renderWidget(byId('weekly-goal'), 'XL');
    tap(r.container, 'Edit goal');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('left / right balance: saved side tests are listed with the weaker side', () => {
    PRESETS.local();
    const out = textOf('lr-balance', 'XL');
    expect(out).toContain('Single Leg Press');
  });

  it('muscle map: Details opens the volume view', () => {
    window.location.hash = '';
    const r = renderWidget(byId('muscle-map'), 'XL');
    tap(r.container, 'Details');
    expect(window.location.hash).toBe('#/progress/volume');
  });
});
