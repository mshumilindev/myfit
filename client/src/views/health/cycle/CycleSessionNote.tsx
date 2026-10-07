/**
 * One quiet, neutral line under the RPE hint in the set editor. It only reports the person's own
 * pattern (a phase whose interval excludes 0) and never changes a number, load or target.
 */
import { useMemo, useState } from 'react';
import { cyclePatterns } from '../../../cycle/cyclePatterns';
import { cycleToday } from '../../../cycle/cycleView';
import { useT } from '../../../i18n';
import { useCycle, useStore } from '../../../store';
import { fmtRpe } from './CyclePatternsView';

export function CycleSessionNote({ className = 'se-hint' }: { className?: string }) {
  const { t } = useT();
  const cycle = useCycle();
  const { workouts, conditions } = useStore();
  const [now] = useState(() => Date.now());
  const today = cycle.enabled && cycle.surfaces.session ? cycleToday(cycle, conditions, now) : null;
  const note = useMemo(() => {
    if (!today || today.kind !== 'ok' || !cycle.settings) return null;
    const k = cyclePatterns(cycle.starts, cycle.settings, workouts).phases.find(
      (p) => p.phase === today.est.phase,
    );
    if (!k || !k.distinct) return null;
    const diff = fmtRpe(Math.abs(k.diff));
    return k.diff > 0 ? t.cycSessionHigher(diff) : t.cycSessionLower(diff);
  }, [today, cycle.settings, cycle.starts, workouts, t]);
  if (!note) return null;
  return (
    <div className={className} data-testid="cycle-session-note">
      {note}
    </div>
  );
}
