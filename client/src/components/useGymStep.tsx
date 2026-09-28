/**
 * The gym step before a session starts, shared by every "start" button:
 * standing in one of your gyms → start there with no question; anywhere else
 * → the gym picker first (it also finds gyms nearby that aren't saved yet).
 */
import { useState, type ReactNode } from 'react';
import { gymAtCurrentPosition, useStore } from '../store';
import { useT } from '../i18n';
import { GymPicker } from './GymPicker';

export function useGymStep(): {
  /** Resolve the gym, then run `start(gymId)`. */
  withGym: (start: (gymId: string | null) => void) => Promise<void>;
  /** Render this somewhere in the component (the picker sheet, when open). */
  gymPicker: ReactNode;
} {
  const { t } = useT();
  const store = useStore();
  const [pending, setPending] = useState<((gymId: string | null) => void) | null>(null);
  async function withGym(start: (gymId: string | null) => void) {
    const here = await gymAtCurrentPosition(store.gyms);
    if (here) start(here.id);
    else setPending(() => start);
  }
  const gymPicker = pending ? (
    <GymPicker
      gyms={store.gyms}
      title={t.pickGymTitle}
      onClose={() => setPending(null)}
      onPick={(id) => {
        setPending(null);
        pending(id);
      }}
    />
  ) : null;
  return { withGym, gymPicker };
}
