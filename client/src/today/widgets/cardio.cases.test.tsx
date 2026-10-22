import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { CARDIO_WIDGETS } from './cardio';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => CARDIO_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('cardio widgets', CARDIO_WIDGETS);
widgetMatrix('cardio widgets (other locales)', CARDIO_WIDGETS, {
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

describe('cardio: what each widget reports for the rich fixture history', () => {
  it.each([
    ['distance-week', 'M', ['29.5 km this week', 'Cycling 18.0', 'Run 5.4', 'Walk 3.1']],
    ['distance-week', 'XL', ['+25.2 km', 'last week 4.3']],
    ['last-route', 'M', ['Run · 5.4 km · 35:00', 'Yesterday 09:00', '6:29 /km']],
    ['last-route', 'XL', ['Easy loop by the river', 'Burned', '466 kcal', 'Swim · Sep 15']],
    ['pace-trend', 'M', ['6:29 /km last run', '7 s slower over 3 runs']],
    ['pace-trend', 'XL', ['+0:07 /km', 'avg 6:30 /km', '6:22 /km · best']],
    ['cardio-machine', 'M', ['Treadmill Running · 3.0 km', '3 000 m', '20:00', '220 kcal']],
    ['cardio-machine', 'XL', ['Treadmill Running · 5 sessions', '3.4 → 3.0']],
    ['active-minutes', 'M', ['145 / 150 active min', '5 min to go', '2 days left']],
    ['active-minutes', 'XL', ['WHO 150', '97%', '~3 min/day']],
    ['favourite-sport', 'M', ['Run · 3× in 30 days', 'Cycling 2×', 'Hiking 1×']],
    ['favourite-sport', 'XL', ['11 sessions', 'Football']],
    ['recovery-rituals', 'M', ['3 recovery sessions', 'Last: mobility']],
    ['recovery-rituals', 'XL', ['Yoga', 'Mobility', 'Sauna', '3 more than Aug']],
    ['activity-kcal', 'M', ['1 186 kcal from activities', 'top: Run 466']],
    ['activity-kcal', 'XL', ['last week 360', 'Cycling', '400']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('cardio: empty history', () => {
  it.each(CARDIO_WIDGETS.map((w) => [w.id] as const))(
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
    for (const w of CARDIO_WIDGETS) {
      const r = renderWidget(w, 'M');
      expect(r.container.querySelector('button, [role=button], a')).not.toBeNull();
      cleanup();
    }
  });
});

describe('cardio: interaction', () => {
  const tap = (container: HTMLElement, name: string | RegExp) =>
    fireEvent.click(within(container).getAllByRole('button', { name })[0]);
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('last route: "Log activity" opens the activity logger', () => {
    const r = renderWidget(byId('last-route'), 'XL');
    tap(r.container, 'Log activity');
    expect(Object.keys(r.ctx.shell.calls).length).toBeGreaterThan(0);
  });

  it('active minutes: the card opens the activity history', () => {
    const r = renderWidget(byId('active-minutes'), 'M');
    fireEvent.click(r.container.querySelector<HTMLElement>('.uiw-hit')!);
    expect(Object.keys(r.ctx.shell.calls).length).toBeGreaterThan(0);
  });

  it('with no activities the distance card says there is nothing this week', () => {
    seed(STATES.empty());
    expect(textOf('distance-week', 'M')).not.toMatch(/\d+(\.\d)? km this week/);
  });
});
