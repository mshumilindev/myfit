import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { DISCOVER_WIDGETS } from './discover';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => DISCOVER_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('discover widgets', DISCOVER_WIDGETS);
widgetMatrix('discover widgets (other locales)', DISCOVER_WIDGETS, {
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

describe('discover: what each widget reports for the rich fixture history', () => {
  it.each([
    ['exercise-of-the-day', 'M', ['Alternate Hammer Curl', 'Exercise of the day', 'Biceps']],
    ['exercise-of-the-day', 'XL', ['Neutral grip, elbows pinned', 'Add to today', 'Skip']],
    ['tip-of-the-day', 'M', ['Push the floor away', 'Barbell Deadlift']],
    ['tip-of-the-day', 'XL', ['Yanking with the back rounds the spine']],
    ['kit-spotlight', 'M', ['Cast-iron kettlebell', 'Iron Yard']],
    ['kit-spotlight', 'XL', ['Kit spotlight · Iron Yard', 'Kettlebell Dead Clean', 'See 3 moves']],
    ['on-this-day', 'M', ['1 month ago: Barbell Deadlift 162 kg', 'e1RM 168 kg']],
    ['on-this-day', 'XL', ['Then', '162 kg', 'Now', '168 kg', 'Open that session']],
    ['lifetime-lifted', 'M', ['124 t lifted, ever', 'City bus', '30 sessions']],
    ['lifetime-lifted', 'XL', ['Tonnage by month', 'Next: Blue whale', '124 / 150 t']],
    ['night-sky', 'M', ['Bed 23:00 → 07:00', 'Full moon', 'in 11h 00m']],
    ['night-sky', 'XL', ['Full moon tonight', 'Wake', '07:00']],
    ['challenge-to-try', 'M', ['Try: 7-day streak', '10 days']],
    [
      'challenge-to-try',
      'XL',
      ['Start challenge', 'Another', 'Train (or take a planned rest day) every day'],
    ],
    ['rest-day-idea', 'M', ['Rest day · try 40 min walk', 'Traps still at 38%']],
    ['rest-day-idea', 'XL', ['Muscle recovery · keep it easy', 'Lats', '40%', 'Start walk']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('discover: empty history', () => {
  it.each(DISCOVER_WIDGETS.map((w) => [w.id] as const))(
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
    for (const w of DISCOVER_WIDGETS) {
      const r = renderWidget(w, 'M');
      expect(r.container.querySelector('button, [role=button], a')).not.toBeNull();
      cleanup();
    }
  });
});

describe('discover: interaction', () => {
  const tap = (container: HTMLElement, name: string | RegExp) =>
    fireEvent.click(within(container).getAllByRole('button', { name })[0]);
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('exercise of the day: Skip picks another exercise', () => {
    const r = renderWidget(byId('exercise-of-the-day'), 'XL');
    expect(r.container.textContent).toContain('Alternate Hammer Curl');
    tap(r.container, 'Skip');
    expect(r.container.textContent).not.toContain('Alternate Hammer Curl');
    expect(r.container.textContent).toContain('Add to today');
  });

  it('exercise of the day: the pick is remembered for the day in localStorage', () => {
    const r = renderWidget(byId('exercise-of-the-day'), 'XL');
    tap(r.container, 'Skip');
    const saved = JSON.parse(localStorage.getItem('spotter.tw.exercise-of-the-day')!);
    expect(saved.n).toBeGreaterThan(0);
  });

  it('challenge to try: "Another" rolls a different challenge', () => {
    const r = renderWidget(byId('challenge-to-try'), 'XL');
    const before = r.container.textContent;
    tap(r.container, 'Another');
    expect(r.container.textContent).not.toBe(before);
  });
});
