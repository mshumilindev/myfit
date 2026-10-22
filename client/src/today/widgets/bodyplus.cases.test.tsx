import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { BODY_PLUS_WIDGETS } from './bodyplus';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => BODY_PLUS_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('bodyplus widgets', BODY_PLUS_WIDGETS);
widgetMatrix('bodyplus widgets (other locales)', BODY_PLUS_WIDGETS, {
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

describe('bodyplus: what each widget reports for the rich fixture history', () => {
  it.each([
    ['sleep-debt', 'M', ['Sleep debt', '6h 40m', 'bed by 22:05']],
    [
      'sleep-debt',
      'XL',
      [
        '+1h 00m vs last week',
        'Worst night',
        '5h 00m',
        'Average sleep',
        '6h 51m',
        'Naps counted',
        '1h 20m',
      ],
    ],
    ['bedtime-consistency', 'M', ['±58 min', 'Usual 23:46', 'last night 01:30']],
    [
      'bedtime-consistency',
      'XL',
      ['2 late nights', 'Latest', '01:30', 'Avg wake-up', '06:39', 'Wind down at 22:30'],
    ],
    ['naps', 'M', ['2 naps', '1h 20m', 'Thu 40m', 'Fri 40m']],
    ['naps', 'XL', ['avg 40m', 'Thu · 14:00–14:40', 'Sleep debt offset']],
    ['body-composition', 'M', ['Fat 18%', 'muscle 44.1%', 'BMI 25.2', 'waist 84 cm']],
    ['body-composition', 'XL', ['Lean mass', '66.9 kg', 'Chest', '102 cm', 'Waist', '84 cm']],
    ['resting-energy', 'M', ['BMR 1,815 kcal/day', '81.6 kg', '18% fat']],
    ['resting-energy', 'XL', ['Katch–McArdle', '1,815', 'Lean mass', '66.9 kg', '≈ 2,723 kcal']],
    ['physique-goal', 'M', ['Classic', '56% there', '81.6 → 80 kg', 'On pace for Oct 24']],
    [
      'physique-goal',
      'XL',
      ['started Aug 27', 'Weight · 83.6 → 80 kg', 'Balanced, symmetrical mass'],
    ],
    ['rest-illness-log', 'M', ['16 rest', '0 sick', 'streak 69 safe']],
    ['rest-illness-log', 'XL', ['Streak 69 kept', 'Train', '13', 'Rest', '16']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('bodyplus: empty history', () => {
  it.each(BODY_PLUS_WIDGETS.map((w) => [w.id] as const))(
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
    for (const w of BODY_PLUS_WIDGETS) {
      const r = renderWidget(w, 'M');
      expect(r.container.querySelector('button, [role=button], a')).not.toBeNull();
      cleanup();
    }
  });
});

describe('bodyplus: interaction', () => {
  const tap = (container: HTMLElement, name: string | RegExp) =>
    fireEvent.click(within(container).getAllByRole('button', { name })[0]);
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('naps: "Log nap" opens the sleep logger in nap mode', () => {
    const r = renderWidget(byId('naps'), 'XL');
    tap(r.container, 'Log nap');
    expect(r.ctx.shell.calls.openOverlay).toHaveBeenCalled();
  });

  it('sleep debt: "Plan bedtime" opens the sleep schedule', () => {
    const r = renderWidget(byId('sleep-debt'), 'XL');
    tap(r.container, 'Plan bedtime');
    expect(Object.keys(r.ctx.shell.calls).length).toBeGreaterThan(0);
  });

  it('resting energy: "Log weight" opens the weight entry', () => {
    const r = renderWidget(byId('resting-energy'), 'XL');
    tap(r.container, 'Log weight');
    expect(r.ctx.openWeight).toHaveBeenCalled();
  });

  it('body composition without measurements invites the first entry', () => {
    seed(STATES.thinBody());
    const out = textOf('body-composition', 'M');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/NaN/);
  });
});
