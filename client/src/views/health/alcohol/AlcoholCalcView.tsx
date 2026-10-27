/**
 * Alcohol, "Use in calculations" (the nicotine 3B pattern): the master switch plus two groups
 * of per-surface switches: "Based on research (weak)" (readiness, sleep, trends, after-workout
 * hints) and "Experimental" (no research behind it, off by default). The research disclaimer
 * sits under the estimate. Switches apply immediately (like the other settings screens), so
 * there is no Save; Done just leaves the page. Kit primitives only.
 */
import { SurfaceCalcView } from '../SurfaceCalcView';
import { useT } from '../../../i18n';
import { ALCOHOL_SURFACES, isExperimentalSurface } from '../../../alcohol';
import { setAlcoholSurface, setAlcoholUseInCalculations, useAlcohol } from '../../../store';
import type { AlcoholSurface } from '../../../types';

const SURFACE_ICON: Record<AlcoholSurface, string> = {
  readiness: 'heartbeat',
  sleep: 'moon',
  fatigue: 'arrows-down-up',
  progression: 'trend-up',
  trends: 'chart-line',
  afterWorkoutHints: 'flag-checkered',
};

const RESEARCH = ALCOHOL_SURFACES.filter((s) => !isExperimentalSurface(s));
const EXPERIMENTAL = ALCOHOL_SURFACES.filter(isExperimentalSurface);

export interface AlcoholCalcViewProps {
  onBack: () => void;
}

export function AlcoholCalcView({ onBack }: AlcoholCalcViewProps) {
  const { t } = useT();
  const { settings } = useAlcohol();
  const labels: Record<AlcoholSurface, { label: string; sub: string }> = {
    readiness: { label: t.nicSfReadiness, sub: t.nicSfReadinessSub },
    sleep: { label: t.nicSfSleep, sub: t.nicSfSleepSub },
    fatigue: { label: t.nicSfFatigue, sub: t.nicSfFatigueSub },
    progression: { label: t.nicSfProgression, sub: t.nicSfProgressionSub },
    trends: { label: t.nicSfTrends, sub: t.nicSfTrendsSub },
    afterWorkoutHints: { label: t.nicSfAfter, sub: t.alcSfAfterSub },
  };
  return (
    <SurfaceCalcView
      onBack={onBack}
      master={settings.useInCalculations}
      onMaster={setAlcoholUseInCalculations}
      masterLabel={t.alcCalcMaster}
      masterSub={t.alcCalcMasterSub}
      surfaces={settings.surfaces}
      onSurface={setAlcoholSurface}
      research={RESEARCH}
      experimental={EXPERIMENTAL}
      icons={SURFACE_ICON}
      labels={labels}
      disclaimer={t.alcoholDisclaimer}
    />
  );
}
