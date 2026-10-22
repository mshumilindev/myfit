/** The Cycle pages as one switch. Navigation lives in the caller (Health overlay routes). */
import { useState } from 'react';
import { cyclePause } from '../../../cycle/cycleView';
import { useCycle, useStoredLimits, useStore } from '../../../store';
import { CycleHubView } from './CycleHubView';
import { CyclePatternsView } from './CyclePatternsView';
import { CycleSetupView } from './CycleSetupView';

export type CycleScreen = 'hub' | 'settings' | 'patterns';

export function CycleScreens({
  screen,
  onOpen,
  onBack,
  onOpenStates,
}: {
  screen: CycleScreen;
  onOpen: (screen: CycleScreen) => void;
  onBack: () => void;
  onOpenStates: () => void;
}) {
  const cycle = useCycle();
  const { conditions } = useStore();
  const limits = useStoredLimits();
  const [now] = useState(() => Date.now());
  const suppressed = cyclePause(conditions, limits.conditions, now);
  // Not set up yet (and not paused by a condition): the first run is the setup form.
  if ((!cycle.enabled || !cycle.settings) && !suppressed) return <CycleSetupView onBack={onBack} />;
  if (screen === 'settings' && !suppressed) return <CycleSetupView onBack={() => onOpen('hub')} />;
  if (screen === 'patterns' && !suppressed)
    return <CyclePatternsView onBack={() => onOpen('hub')} />;
  return (
    <CycleHubView
      onBack={onBack}
      onSettings={() => onOpen('settings')}
      onPatterns={() => onOpen('patterns')}
      onOpenStates={onOpenStates}
    />
  );
}
