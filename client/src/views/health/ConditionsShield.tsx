import { useState } from 'react';
import { isActive } from '../../conditions';
import { BrandIconButton } from '../../components/ui/BrandBar';
import { RailItem } from '../../components/ui/Rail';
import { useFlag } from '../../data/flags';
import { useT } from '../../i18n';
import { useStore } from '../../store';

/** Count of active health conditions; 0 while the `conditions` flag is off. */
export function useActiveConditions(): number {
  const on = useFlag('conditions');
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  return on ? conditions.filter((c) => isActive(c, now)).length : 0;
}

/** Header / rail shield: plans are adapted to active conditions; opens Health. Hidden with none. */
export function ConditionsShield({
  onOpen,
  variant = 'header',
}: {
  onOpen: () => void;
  variant?: 'header' | 'rail';
}) {
  const { t } = useT();
  const n = useActiveConditions();
  if (n === 0) return null;
  const label = t.cndTodayTitle(n);
  if (variant === 'rail')
    return <RailItem icon="shield-check" ariaLabel={label} onClick={onOpen} />;
  return <BrandIconButton icon="shield-check" label={label} onClick={onOpen} />;
}
