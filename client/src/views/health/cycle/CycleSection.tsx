/**
 * Health › Lifestyle › Cycle: one quiet row, visible to everyone. The feature itself is
 * active only after the person turns it on (docs: «Цикл — концепція»).
 */
import { useEffect, useState } from 'react';
import { IconTile } from '../../../components/ui/IconTile';
import { ListRow } from '../../../components/ui/GroupedList';
import { cycleSuppressedBy, estimate } from '../../../cycle/cycleCore';
import { setCyclePendingDate, useCycle, useStore } from '../../../store';
import { CYCLE_TONE, todayKey, useCycleText } from './text';

export function CycleHealthRow({ onOpen }: { onOpen: () => void }) {
  const { t, phaseName } = useCycleText();
  const cycle = useCycle();
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  const suppressed = cycleSuppressedBy(conditions, now);
  useEffect(() => {
    if (cycle.enabled && suppressed) setCyclePendingDate(true);
  }, [cycle.enabled, suppressed]);

  let sub = t.cycRowOff;
  if (cycle.enabled && cycle.settings) {
    if (suppressed) sub = suppressed === 'pregnancy' ? t.cycRowPaused : t.cycRowMenopause;
    else if (cycle.settings.mode === 'log') sub = t.cycRowLog;
    else {
      const e = estimate(cycle.settings, todayKey());
      sub = e ? t.cycRowDay(e.dayOfCycle, phaseName[e.phase]) : t.cycStaleBtn;
    }
  }
  return (
    <ListRow
      icon={<IconTile tone={CYCLE_TONE} size={30} icon="drop-half" />}
      label={t.cycTitle}
      sub={sub}
      chevron
      onClick={onOpen}
    />
  );
}
