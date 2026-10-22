import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { BODY_WIDGETS } from './body';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => BODY_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) => {
  const r = renderWidget(byId(id), size);
  const text = r.container.textContent ?? '';
  return { ...r, text };
};
const click = (container: HTMLElement) =>
  fireEvent.click(container.querySelector<HTMLElement>('button, [role=button]')!);

widgetMatrix('body widgets', BODY_WIDGETS);
widgetMatrix('body widgets (other locales)', BODY_WIDGETS, {
  locales: ['uk', 'pl', 'lt', 'et'],
  scenarios: [
    ['rich', 'program'],
    ['busyToday', 'program'],
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

describe('Readiness', () => {
  it('rich history: average readiness, how many muscles are still recovering, the lowest first', () => {
    seed(STATES.rich());
    expect(textOf('readiness', 'S').text).toBe('Readiness80%5 recovering');
    cleanup();
    expect(textOf('readiness', 'M').text).toBe('Readiness 80%5 recovering');
    cleanup();
    const xl = textOf('readiness', 'XL').text;
    expect(xl).toContain('Muscle readiness80%');
    expect(xl.indexOf('Traps')).toBeLessThan(xl.indexOf('Chest'));
  });

  it('no history: everything is ready', () => {
    seed(STATES.empty());
    expect(textOf('readiness', 'S').text).toBe('Readiness100%All muscles ready');
  });

  it('opens the Progress tab', () => {
    seed(STATES.rich());
    for (const size of ['S', 'M', 'L', 'XL'] as const) {
      const { container, ctx, unmount } = renderWidget(byId('readiness'), size);
      click(container);
      expect(ctx.shell.calls.goTab).toHaveBeenCalledWith('progress');
      unmount();
    }
  });
});

describe('Sleep', () => {
  it('shows the last night, its span and the 7-night average', () => {
    seed(STATES.rich());
    expect(textOf('sleep', 'S').text).toBe('Last night5h00m01:30 → 06:30');
    cleanup();
    expect(textOf('sleep', 'M').text).toBe('Slept 5h 00m01:30 → 06:30');
    cleanup();
    expect(textOf('sleep', 'L').text).toBe('Last night01:30 → 06:305h 00m7-night avg 6h 51m');
    cleanup();
    expect(textOf('sleep', 'XL').text).toContain('Sleep · 7 nights6h 51m');
  });

  it('opens the last night for editing; with no night it opens a backfill', () => {
    seed(STATES.rich());
    const a = renderWidget(byId('sleep'), 'M');
    click(a.container);
    expect(a.ctx.shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'sleep',
      mode: 'edit',
      nightId: 'sl-0',
    });
    cleanup();
    seed(STATES.empty());
    const b = renderWidget(byId('sleep'), 'M');
    click(b.container);
    expect(b.ctx.shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'sleep',
      mode: 'backfill',
      nightId: undefined,
    });
    expect(b.container.textContent).toBe('No night logged yetLog sleep');
  });

  it('empty S has no button, L/XL offer "Log sleep"', () => {
    seed(STATES.empty());
    expect(textOf('sleep', 'S').container.textContent).toBe('Last nightNo night logged yet');
    cleanup();
    for (const size of ['L', 'XL'] as const) {
      const { container, unmount } = textOf('sleep', size);
      expect(container.textContent).toContain('Log sleep');
      unmount();
    }
  });
});

describe('Body weight', () => {
  it('latest weigh-in, change this week and over 30 days', () => {
    seed(STATES.rich());
    expect(textOf('body-weight', 'S').text).toBe('Body weight81.6kg−0.4 this week');
    cleanup();
    expect(textOf('body-weight', 'L').text).toBe('Body weight · 30 days−1.6 kg81.6kg');
  });

  it('with no weigh-ins it asks to log one and the button opens the weigh-in sheet', () => {
    seed(STATES.empty());
    const { container, ctx } = renderWidget(byId('body-weight'), 'L');
    expect(container.textContent).toBe('Body weightNo weigh-ins yetLog weight');
    fireEvent.click(screen.getByRole('button', { name: 'Log weight' }));
    expect(ctx.openWeight).toHaveBeenCalledTimes(1);
  });

  it('a single weigh-in has no trend to show', () => {
    seed(STATES.thinBody());
    const { text } = textOf('body-weight', 'L');
    expect(text).toContain('90');
    expect(text).not.toContain('30 days−');
  });
});

describe('Energy today', () => {
  it('resting burn only on a day without training', () => {
    seed(STATES.rich());
    expect(textOf('energy-today', 'M').text).toBe('1,361 kcal today0 active · 1,361 resting');
  });

  it("adds today's workout and activity as active energy, listed by time", () => {
    seed(STATES.busyToday());
    const xl = textOf('energy-today', 'XL');
    expect(xl.text).toMatch(/Workout\d+|Legs/);
    const m = textOf('energy-today', 'M').text;
    expect(m).not.toContain('0 active');
    expect(Number(/(\d[\d,]*) kcal today/.exec(m)![1].replace(',', ''))).toBeGreaterThan(1361);
  });

  it('without a weight it says there is no data and offers the weigh-in', () => {
    seed(STATES.empty());
    const { ctx } = renderWidget(byId('energy-today'), 'L');
    fireEvent.click(screen.getByRole('button', { name: 'Log weight' }));
    expect(ctx.openWeight).toHaveBeenCalledTimes(1);
  });
});

describe('Rehab', () => {
  it('shows the open injury, its stage and the check-ins still needed', () => {
    seed(STATES.rich());
    expect(textOf('rehab', 'S').text).toBe('Rehab2/4Knee (Left) · Reintroduce');
    cleanup();
    expect(textOf('rehab', 'M').text).toBe(
      'Knee (Left) · Stage 2 of 40 of 2 good check-ins to move up',
    );
    cleanup();
    expect(textOf('rehab', 'XL').text).toContain('Protected muscles · loadQuads50%');
  });

  it('with no injury it offers to start a plan', () => {
    seed(STATES.empty());
    expect(textOf('rehab', 'L').text).toBe(
      'RehabNo active rehabHurt? Start a guided planStart rehab plan',
    );
  });

  it('opens the health screen for the injury (or a new plan)', () => {
    seed(STATES.rich());
    const a = renderWidget(byId('rehab'), 'L');
    click(a.container);
    expect(a.ctx.shell.calls.openOverlay).toHaveBeenCalled();
    cleanup();
    seed(STATES.empty());
    const b = renderWidget(byId('rehab'), 'L');
    click(b.container);
    expect(b.ctx.shell.calls.openOverlay).toHaveBeenCalled();
  });
});
