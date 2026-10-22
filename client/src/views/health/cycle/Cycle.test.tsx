import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CycleScreens } from './CycleScreens';
import { CycleHealthRow } from './CycleSection';
import { setLocale } from '../../../i18n';
import { dayOfTimestamp } from '../../../components/ui/calendarDays';
import {
  addCondition,
  resetLocalData,
  getCycle,
  saveCycleSettings,
  useStore,
} from '../../../store';
import { MENOPAUSE_KEY } from '../../../cycle/cycleCore';
import {
  closeHealthPrompt,
  healthPromptFeature,
  setHealthConsentState,
} from '../../../data/healthConsentGate';
import { HEALTH_FEATURES } from '../../../legal/consents';

const nop = () => undefined;
const today = () => dayOfTimestamp(Date.now());
const mount = () =>
  render(<CycleScreens screen="hub" onOpen={nop} onBack={nop} onOpenStates={nop} />);
function Conds() {
  const { conditions } = useStore();
  return <span data-testid="n">{conditions.map((c) => c.key).join(',')}</span>;
}

beforeEach(() => {
  setLocale('en');
  resetLocalData();
});
afterEach(cleanup);
describe('Cycle screens', () => {
  it('first run is the setup form; Save turns the feature on', () => {
    mount();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(getCycle().enabled).toBe(false);
    act(() => fireEvent.click(screen.getByText('Save')));
    expect(getCycle().enabled).toBe(true);
    expect(getCycle().settings?.length).toBe(28);
  });

  it('hub: pregnancy from the Cycle screen creates the condition and switches the Cycle off', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today() - 9 });
    render(<Conds />);
    mount();
    expect(screen.getByText('Mark pregnancy')).toBeTruthy();
    act(() => fireEvent.click(screen.getByText('Mark pregnancy')));
    act(() => fireEvent.click(screen.getByText('Add condition')));
    expect(screen.getByTestId('n').textContent).toMatch(/preg_/);
    expect(screen.getByText('Cycle is off')).toBeTruthy();
  });

  it('menopause from the Cycle screen asks first, then creates it', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today() - 9 });
    render(<Conds />);
    mount();
    act(() => fireEvent.click(screen.getByText('Mark menopause')));
    expect(screen.getByTestId('n').textContent).toBe('');
    act(() => fireEvent.click(screen.getByText('Mark')));
    expect(screen.getByTestId('n').textContent).toBe(MENOPAUSE_KEY);
    expect(screen.getByText('Cycle is off')).toBeTruthy();
  });

  it('a pregnancy added elsewhere also switches it off; row says so', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today() - 9 });
    act(() => {
      addCondition({
        key: 'preg_first',
        severity: 2,
        share: 'off',
        startedAt: Date.now() - 86_400_000 * 20,
      });
    });
    render(<CycleHealthRow onOpen={nop} />);
    expect(screen.getByText('Off during pregnancy')).toBeTruthy();
    expect(getCycle().pendingDate).toBe(true);
  });

  it('row is quiet for everyone who has not turned it on', () => {
    render(<CycleHealthRow onOpen={nop} />);
    expect(screen.getByText('Not set up')).toBeTruthy();
  });

  // SPO-290 review B2: pregnancy / menopause are chronic conditions. Without that consent the buttons ask for it.
  const chronicOff = () =>
    setHealthConsentState({
      on: Object.fromEntries(HEALTH_FEATURES.map((k) => [k, k !== 'chronic'])) as never,
      answered: {} as never,
      ready: true,
    });

  it('hub: with Chronic conditions off, "Mark pregnancy" / "Mark menopause" open the chronic prompt and save nothing', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today() - 9 });
    render(<Conds />);
    mount();
    chronicOff();
    act(() => fireEvent.click(screen.getByText('Mark pregnancy')));
    expect(healthPromptFeature()).toBe('chronic');
    expect(screen.queryByText('Add condition')).toBeNull(); // the pregnancy sheet did not open
    closeHealthPrompt();
    act(() => fireEvent.click(screen.getByText('Mark menopause')));
    expect(healthPromptFeature()).toBe('chronic');
    expect(screen.queryByText('Mark')).toBeNull();
    expect(screen.getByTestId('n').textContent).toBe('');
    closeHealthPrompt();
  });

  it('a pregnancy stored before still pauses the Cycle with Chronic conditions off, without naming it', () => {
    saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: today() - 9 });
    act(() => {
      addCondition({
        key: 'preg_first',
        severity: 2,
        share: 'off',
        startedAt: Date.now() - 86_400_000 * 20,
      });
    });
    chronicOff();
    render(<CycleHealthRow onOpen={nop} />);
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.queryByText('Off during pregnancy')).toBeNull();
    cleanup();
    mount();
    expect(screen.getByText('Cycle is off')).toBeTruthy();
    expect(screen.getByText('The Cycle is paused for now. Your data is kept.')).toBeTruthy();
    expect(screen.queryByText(/pregnancy/i)).toBeNull();
  });
});
