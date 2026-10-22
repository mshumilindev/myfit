import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { en } from '../i18n/en';
import { uk } from '../i18n/uk';
import { ProgReturnNote, progActionLabel } from './ProgReturnNote';
import type { ProgState, Target } from '../progression';

const target = (over: Partial<Target>): Target => ({
  state: 'return',
  weight: 80,
  reps: 7,
  deltaKg: -10,
  repLow: 7,
  repHigh: 10,
  prevWeight: 90,
  prevReps: 10,
  returnKind: 'cut',
  gapDays: 45,
  ...over,
});

describe('progActionLabel', () => {
  it('has its own label for every progression state (no silent fallthrough)', () => {
    const states: ProgState[] = ['first', 'progress', 'hold', 'stall', 'return'];
    const labels = states.map((s) => progActionLabel(en, s));
    expect(new Set(labels).size).toBe(states.length);
    expect(progActionLabel(en, 'return')).toBe(en.progReturn);
    expect(progActionLabel(uk, 'return')).toBe(uk.progReturn);
  });
});

describe('ProgReturnNote', () => {
  afterEach(cleanup);
  const text = (over: Partial<Target>): string | null => {
    const { container } = render(<ProgReturnNote target={target(over)} lift="Squat" />);
    return container.textContent || null;
  };
  it('cut / ease say the whole weeks since the last time, regain has its own line', () => {
    expect(text({})).toBe(en.progReturnCut(6, 'Squat'));
    expect(text({ returnKind: 'ease', gapDays: 20 })).toBe(en.progReturnEase(2, 'Squat'));
    expect(text({ returnKind: 'regain', gapDays: undefined })).toBe(en.progReturnRegain);
  });
  it('renders nothing for any other state', () => {
    expect(text({ state: 'hold', returnKind: undefined })).toBeNull();
  });
});
