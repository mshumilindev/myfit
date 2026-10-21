import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { BODY_PLUS_WIDGETS } from './bodyplus';
import { NOW, PRESETS, STATES, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';
import type { StoreState } from '../../store';

const DAY = 86_400_000;
const byId = (id: string) => BODY_PLUS_WIDGETS.find((w) => w.id === id)!;

/** The rich store with only the body metrics we give it. */
function withBody(bodyMetrics: Record<string, unknown>, goals?: Record<string, unknown>): void {
  const base = STATES.rich();
  seed({ ...base, bodyMetrics, ...(goals ? { goals } : {}) } as unknown as StoreState);
}
const textOf = (id: string, size: WidgetSize) => {
  const r = renderWidget(byId(id), size);
  const out = r.container.textContent ?? '';
  r.unmount();
  return out;
};
const W = (weight: number, daysAgo = 1) => ({ id: `w${daysAgo}`, at: NOW - daysAgo * DAY, weight });

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

describe('body composition with only part of the data', () => {
  it('weight and height only: BMI leads on every size', () => {
    withBody({ weights: [W(80)], heightCm: 180 });
    expect(textOf('body-composition', 'M')).toContain('BMI 24.7');
    const s = textOf('body-composition', 'S');
    expect(s).toContain('BMI');
    expect(s).toContain('24.7');
    expect(textOf('body-composition', 'XL')).toContain('24.7');
  });

  it('body fat only (no height): fat leads, BMI is not invented', () => {
    withBody({ weights: [W(80)], bodyFatPct: 20 });
    const m = textOf('body-composition', 'M');
    expect(m).toContain('Fat 20%');
    expect(m).not.toContain('BMI');
    const s = textOf('body-composition', 'S');
    expect(s).toContain('20');
    expect(s).not.toContain('BMI');
    expect(textOf('body-composition', 'XL')).toContain('Lean mass');
  });

  it('muscle mass only: shown as a share of body weight', () => {
    withBody({ weights: [W(80)], muscleKg: 36 });
    expect(textOf('body-composition', 'M')).toContain('Muscle 45%');
    expect(textOf('body-composition', 'S')).toContain('45');
  });

  it('tape measures only (no weigh-in): the tape line is the headline', () => {
    withBody({ weights: [], chestCm: 100, waistCm: 85, hipCm: 95 });
    const m = textOf('body-composition', 'M');
    expect(m).toContain('Chest 100 · Waist 85 · Hip 95 cm');
    const s = textOf('body-composition', 'S');
    expect(s).toContain('Chest');
    expect(s).toContain('100');
    expect(s).toContain('cm');
  });

  it('fat and BMI together: S shows fat with BMI beneath it', () => {
    withBody({ weights: [W(80)], heightCm: 180, bodyFatPct: 18 });
    const s = textOf('body-composition', 'S');
    expect(s).toContain('18');
    expect(s).toContain('BMI 24.7');
  });

  it('nothing at all: invites to add measurements', () => {
    withBody({ weights: [] });
    for (const size of ['S', 'M', 'L', 'XL'] as const)
      expect(textOf('body-composition', size)).toContain('No body measurements yet');
  });
});

describe('physique goal with partial data', () => {
  const phys = { physique: { archetype: 'classic', sex: 'male', setAt: NOW - 30 * DAY } };

  it('a goal weight already reached on the first weigh-in counts as done', () => {
    withBody({ weights: [W(80, 20), W(80, 1)], goalWeightKg: 80 }, phys);
    const m = textOf('physique-goal', 'M');
    expect(m).toContain('100% there');
    expect(m).toContain('Goal weight reached');
  });

  it('start equal to goal but now away from it: zero progress, kg to go', () => {
    withBody(
      { weights: [W(80, 40), W(82, 1)], goalWeightKg: 80 },
      { physique: { archetype: 'classic', sex: 'male', setAt: NOW - 30 * DAY } },
    );
    const m = textOf('physique-goal', 'M');
    expect(m).toContain('2 kg to go');
  });

  it('weight moving away from the goal gives no ETA, only the distance', () => {
    withBody({ weights: [W(80, 20), W(84, 1)], goalWeightKg: 78 }, phys);
    const m = textOf('physique-goal', 'M');
    expect(m).toContain('kg to go');
    expect(m).not.toContain('On pace');
  });

  it('a trend that would take more than two years gives no ETA', () => {
    withBody({ weights: [W(90.0, 20), W(89.99, 1)], goalWeightKg: 60 }, phys);
    expect(textOf('physique-goal', 'M')).not.toContain('On pace');
  });

  it('a goal weight but no physique archetype still renders', () => {
    withBody({ weights: [W(85, 20), W(83, 1)], goalWeightKg: 80 });
    const m = textOf('physique-goal', 'M');
    expect(m).toContain('80');
  });

  it('no weigh-ins at all: prompts to set a target', () => {
    withBody({ weights: [], goalWeightKg: 80 }, phys);
    const m = textOf('physique-goal', 'M');
    expect(m).toContain('Classic');
    expect(m).not.toContain('NaN');
  });
});
