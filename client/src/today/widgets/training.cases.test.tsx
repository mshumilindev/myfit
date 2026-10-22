import { currentHash } from '../../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { TRAINING_WIDGETS } from './training';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => TRAINING_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('training widgets', TRAINING_WIDGETS);
widgetMatrix('training widgets (other locales)', TRAINING_WIDGETS, {
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

describe('training: what each widget reports for the rich fixture history', () => {
  it.each([
    ['weekly-volume', 'M', ['12.8 t this week', '+2% vs 8-week avg']],
    ['weekly-volume', 'XL', ['Sep 12', '13.1 t', 'Aug 29', '12.3 t']],
    ['lift-record', 'M', ['Bent Over Barbell Row · 92 kg', 'est. 1RM']],
    ['lift-record', 'XL', ['PR · today', 'Change lift', '3 × 8 · 72.5 kg']],
    ['activities-week', 'M', ['125 min active', 'Cycling · Walk · Run']],
    ['activities-week', 'XL', ['1 295 kcal', 'Fri · 5.4 km · 35 min', 'Log activity']],
    ['weekly-recap', 'M', ['Your week is ready', 'Sep 14 – Sep 20 · 3 sessions']],
    ['weekly-recap', 'XL', ['13.1 tonnes', '5 new PRs', 'Most work: Shoulders · 8 sets']],
    ['goals', 'M', ['Classic · 2 in focus', 'Side delt, Quads']],
    ['goals', 'XL', ['Balanced, symmetrical mass', 'Shoulders', '8 / 20 sets', 'Edit goal']],
    ['playbook', 'M', ['3 plays learned']],
    ['playbook', 'XL', ["Lower back isn't covered", 'Start this play', 'All plays']],
    ['weak-points', 'M', ['9 weak points', 'Forearms · Biceps']],
    [
      'weak-points',
      'XL',
      ['Under minimum 6 of 6 weeks', 'Forearms', '2 / 5 sets', 'Fix-it · at Home Rack'],
    ],
    ['fatigue-deload', 'M', ['Fatigue: fresh', 'No deload needed']],
    ['fatigue-deload', 'XL', ['0', 'Open fatigue map']],
    ['my-gym', 'M', ['Home Rack', 'Last visit today']],
    ['my-gym', 'XL', ['3 visits this month', 'Start here']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

describe('training: empty history', () => {
  it.each(TRAINING_WIDGETS.map((w) => [w.id] as const))(
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
    for (const w of TRAINING_WIDGETS) {
      const r = renderWidget(w, 'M');
      expect(r.container.querySelector('button, [role=button], a')).not.toBeNull();
      cleanup();
    }
  });
});

describe('training: interaction and device-local state', () => {
  const tap = (container: HTMLElement, name: string | RegExp) =>
    fireEvent.click(within(container).getAllByRole('button', { name })[0]);
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('lift record: the lift chosen on this device is the one shown', () => {
    localStorage.setItem('spotter.tw.lift-record', 'Barbell Squat');
    expect(textOf('lift-record', 'M')).toContain('Barbell Squat');
  });

  it('lift record: "Change lift" opens a picker sheet', () => {
    const r = renderWidget(byId('lift-record'), 'XL');
    tap(r.container, 'Change lift');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('goals: Edit goal opens the goals page', () => {
    window.location.hash = '';
    const r = renderWidget(byId('goals'), 'XL');
    tap(r.container, 'Edit goal');
    expect(currentHash()).toBe('#/goals');
  });

  it('my gym: Start here begins a session at that gym', () => {
    const r = renderWidget(byId('my-gym'), 'XL');
    tap(r.container, 'Start here');
    expect(Object.keys(r.ctx.shell.calls).length).toBeGreaterThan(0);
  });
});
