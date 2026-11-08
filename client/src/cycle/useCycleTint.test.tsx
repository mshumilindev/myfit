import { addonsPref } from '../addons/enabledSet';
import { HEALTH_ADDONS } from '../addons/testSetup';
import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { useCycleTint } from './useCycleTint';
import { dayOfTimestamp } from '../components/ui/calendarDays';
import { addCondition, resetLocalData, saveCycleSettings, setCycleSurface } from '../store';

// what a test installs it removes again (SPO-500)
afterEach(() => addonsPref.reset());

const box: { tint: ReturnType<typeof useCycleTint> } = { tint: null };
function Probe() {
  const v = useCycleTint();
  useEffect(() => {
    box.tint = v;
  });
  return null;
}
const today = dayOfTimestamp(Date.now());
const setup = () =>
  saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today - 9 });

beforeEach(() => {
  resetLocalData();
  addonsPref.set(HEALTH_ADDONS);
  box.tint = null;
});

describe('useCycleTint', () => {
  it('is off until the person turns the Cycle on', () => {
    render(<Probe />);
    expect(box.tint).toBeNull();
  });
  it('tints by phase once on, and the switch turns it off', () => {
    setup();
    render(<Probe />);
    expect(box.tint?.(today - 8)).toBe('conditioning'); // a bleeding day
    act(() => setCycleSurface('calendar', false));
    expect(box.tint).toBeNull();
  });
  it('is off while a pregnancy pauses the Cycle', () => {
    setup();
    act(() => {
      addCondition({
        key: 'preg_first',
        severity: 2,
        share: 'off',
        startedAt: Date.now() - 86_400_000,
      });
    });
    render(<Probe />);
    expect(box.tint).toBeNull();
  });
});
