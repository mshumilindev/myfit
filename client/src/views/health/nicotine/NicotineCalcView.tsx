/**
 * Nicotine, "Use in calculations" (board 3B): the master switch plus two groups of
 * per-surface switches: "Based on research (weak)" and "Experimental" (no research, off by
 * default). Switches apply immediately (like the other settings screens), so
 * there is no Save; Done just leaves the page. Kit primitives only.
 */
import { SurfaceCalcView } from '../SurfaceCalcView';
import { useT } from '../../../i18n';
import { EVIDENCE_SURFACES, EXPERIMENTAL_SURFACES } from '../../../nicotine';
import { setNicotineSurface, setNicotineUseInCalculations, useNicotine } from '../../../store';
import type { NicotineSurface } from '../../../types';

const SURFACE_ICON: Record<NicotineSurface, string> = {
  readiness: 'heartbeat',
  fatigue: 'arrows-down-up',
  sleep: 'moon',
  warmup: 'clock',
  rest: 'timer',
  progression: 'trend-up',
  rpe: 'gauge',
  trends: 'chart-line',
  afterWorkoutHints: 'flag-checkered',
};

export interface NicotineCalcViewProps {
  onBack: () => void;
}

export function NicotineCalcView({ onBack }: NicotineCalcViewProps) {
  const { t } = useT();
  const { settings } = useNicotine();
  const labels: Record<NicotineSurface, { label: string; sub: string }> = {
    readiness: { label: t.nicSfReadiness, sub: t.nicSfReadinessSub },
    fatigue: { label: t.nicSfFatigue, sub: t.nicSfFatigueSub },
    sleep: { label: t.nicSfSleep, sub: t.nicSfSleepSub },
    warmup: { label: t.nicSfWarmup, sub: t.nicSfWarmupSub },
    rest: { label: t.nicSfRest, sub: t.nicSfRestSub },
    progression: { label: t.nicSfProgression, sub: t.nicSfProgressionSub },
    rpe: { label: t.nicSfRpe, sub: t.nicSfRpeSub },
    trends: { label: t.nicSfTrends, sub: t.nicSfTrendsSub },
    afterWorkoutHints: { label: t.nicSfAfter, sub: t.nicSfAfterSub },
  };
  return (
    <SurfaceCalcView
      onBack={onBack}
      master={settings.useInCalculations}
      onMaster={setNicotineUseInCalculations}
      masterLabel={t.nicCalcMaster}
      masterSub={t.nicCalcMasterSub}
      surfaces={settings.surfaces}
      onSurface={setNicotineSurface}
      research={EVIDENCE_SURFACES}
      experimental={EXPERIMENTAL_SURFACES}
      icons={SURFACE_ICON}
      labels={labels}
      disclaimer={t.nicFxDisclaimer}
    />
  );
}
