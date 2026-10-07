import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CycleSessionNote } from './CycleSessionNote';
import { CyclePatternsView } from './CyclePatternsView';
import { cycleToday } from '../../../cycle/cycleView';
import { emptyCycleState } from '../../../cycle/cycleState';
import { setLocale } from '../../../i18n';
import { dayOfTimestamp } from '../../../components/ui/calendarDays';
import {
  resetLocalData,
  saveCycleSettings,
  setCycleSurface,
  updateCycleAnchor,
} from '../../../store';

const today = dayOfTimestamp(Date.now());
beforeEach(() => {
  cleanup();
  setLocale('en');
  resetLocalData();
});

describe('cycleToday', () => {
  it('off, log, stale, ok', () => {
    const now = Date.now();
    expect(cycleToday(emptyCycleState(), [], now).kind).toBe('off');
    const base = { ...emptyCycleState(), enabled: true };
    const s = { length: 28, period: 5, anchor: today - 9 };
    expect(cycleToday({ ...base, settings: { mode: 'log', ...s } }, [], now).kind).toBe('log');
    expect(cycleToday({ ...base, settings: { mode: 'regular', ...s } }, [], now).kind).toBe('ok');
    expect(
      cycleToday({ ...base, settings: { mode: 'regular', ...s, anchor: today - 200 } }, [], now)
        .kind,
    ).toBe('stale');
    expect(
      cycleToday({ ...base, pendingDate: true, settings: { mode: 'regular', ...s } }, [], now).kind,
    ).toBe('stale');
  });
});

describe('session note', () => {
  it('shows nothing without a proven pattern', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today - 9 });
    const { container } = render(<CycleSessionNote />);
    expect(container.textContent).toBe('');
  });
});

describe('patterns screen', () => {
  it('says plainly when there is not enough data', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today - 9 });
    render(<CyclePatternsView onBack={() => undefined} />);
    expect(screen.getByText('Not enough data yet')).toBeTruthy();
  });
});

describe('entered starts', () => {
  it('each setup/update date is remembered for patterns, oldest first', async () => {
    const { getCycle } = await import('../../../store');
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today - 60 });
    act(() => updateCycleAnchor(today - 32));
    act(() => updateCycleAnchor(today - 4));
    expect(getCycle().starts).toEqual([today - 60, today - 32, today - 4]);
    act(() => setCycleSurface('session', false));
    expect(getCycle().surfaces.session).toBe(false);
  });
});
