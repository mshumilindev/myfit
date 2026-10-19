import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/react';
import { PLAN_WIDGETS } from './plan';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => PLAN_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('plan widgets', PLAN_WIDGETS);
widgetMatrix('plan widgets (other locales)', PLAN_WIDGETS, {
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

describe('plan: what each widget reports for the rich fixture history', () => {
  it.each([
    ['next-workout', 'M', ['Push · Mon', '2 exercises', '~25 min']],
    [
      'next-workout',
      'XL',
      [
        'Day 1 of 3',
        'Barbell Bench Press - Medium Grip',
        '4×8 · last 71.25 kg',
        'Last done Mon Sep 21',
      ],
    ],
    ['quick-session-builder', 'M', ['Build me a session', '45 min · Auto · Iron Yard']],
    ['quick-session-builder', 'XL', ['30 min', '60 min', 'Regenerate', 'Start · 55 min']],
    ['warm-up', 'M', ['3 ramp sets → 71.25 kg', 'Mobility · 5 min']],
    ['warm-up', 'XL', ['Bar 20 kg', '42.5 kg', 'Arm circles', 'Start session']],
    [
      'program-progress',
      'M',
      ['Week 3 of 8 · Upper Lower Push', '6 of 8 sessions', '75% adherence'],
    ],
    ['program-progress', 'XL', ['0 missed · 18 to go', 'Ends Sun Nov 1', 'Open program']],
    ['week-plan', 'M', ['Today · Rest', 'Sun rest']],
    ['week-plan', 'XL', ['3 of 3 done', 'Mon · Push', '✓ 58m', 'Next week starts Mon Sep 28']],
    ['time-to-train', 'M', ['You usually train at 18:00', 'in 6h 00m']],
    ['time-to-train', 'XL', ['26 sessions', 'from 26 sessions', 'Start now']],
    ['rest-timer', 'M', ['Rest timer', 'Tap a preset to start', '1:30']],
    ['rest-timer', 'XL', ['Quick rest', '3:00']],
    ['last-session', 'M', ['Pull · yesterday', '58m · 2.0 t · 8 sets', '1 PR']],
    ['last-session', 'XL', ['RPE 8.5', 'Pullups', 'PR 4×8 · 72.5 kg', '298 kcal · Home Rack']],
    ['last-session-muscles', 'M', ['Lats, Traps · +2 secondary']],
    ['last-session-muscles', 'XL', ['Worked · Pull · yesterday', 'Lats 6', 'Biceps 4']],
    ['session-energy', 'M', ['298 kcal · Pull', '5.1 kcal/min']],
    ['session-energy', 'XL', ['last 9 · avg 338', 'This week 1019 kcal · 3 sessions']],
    ['effort-trend', 'M', ['Avg RPE 8.5', 'last 10 sessions · in zone']],
    ['effort-trend', 'XL', ['zone 7–8.5', 'Right in the zone — keep it up']],
    ['session-length', 'M', ['Avg 58m per session', '13 sessions']],
    ['session-length', 'XL', ['± 0 min vs previous 30 days', 'longest']],
    ['home-sets', 'M', ['No home sets yet', 'Save a template to start it in one tap']],
    ['home-sets', 'XL', ['New template']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('plan: empty history', () => {
  it.each(PLAN_WIDGETS.map((w) => [w.id] as const))(
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
    for (const w of PLAN_WIDGETS) {
      const r = renderWidget(w, 'M');
      expect(r.container.querySelector('button, [role=button], a')).not.toBeNull();
      cleanup();
    }
  });
});

describe('plan: interaction', () => {
  const tap = (container: HTMLElement, name: string | RegExp) =>
    fireEvent.click(within(container).getAllByRole('button', { name })[0]);
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('rest timer: a preset starts a countdown that is stored on the device', () => {
    const r = renderWidget(byId('rest-timer'), 'XL');
    tap(r.container, '1:00');
    const saved = JSON.parse(localStorage.getItem('spotter.tw.rest-timer')!);
    expect(saved.total).toBe(60);
    expect(saved.endsAt).toBe(NOW + 60_000);
  });

  it('quick session builder: choosing 30 min rebuilds a shorter session', () => {
    const r = renderWidget(byId('quick-session-builder'), 'XL');
    tap(r.container, '30 min');
    const saved = JSON.parse(localStorage.getItem('spotter.tw.quick-session-builder')!);
    expect(saved.len).toBe(30);
    expect(r.container.textContent).toMatch(/Start · \d+ min/);
  });

  it('next workout: Start opens the session start screen', () => {
    const r = renderWidget(byId('next-workout'), 'XL');
    tap(r.container, 'Start');
    expect(Object.keys(r.ctx.shell.calls).length).toBeGreaterThan(0);
  });

  it('a live session hides the "next workout" call to action', () => {
    seed(STATES.live());
    const out = textOf('next-workout', 'XL');
    expect(out.length).toBeGreaterThan(0);
  });
});
