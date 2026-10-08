import { useState } from 'react';
import { isActive } from '../../conditions';
import { BrandIconButton } from '../../components/ui/BrandBar';
import { RailItem } from '../../components/ui/Rail';
import { useT } from '../../i18n';
import { useStore } from '../../store';

/** Count of active health conditions. */
export function useActiveConditions(): number {
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  return conditions.filter((c) => isActive(c, now)).length;
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
