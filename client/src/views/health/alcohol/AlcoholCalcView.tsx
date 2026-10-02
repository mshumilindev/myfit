/**
 * Alcohol, "Use in calculations" (the nicotine 3B pattern): the master switch plus two groups
 * of per-surface switches: "Based on research (weak)" (readiness, sleep, trends, after-workout
 * hints) and "Experimental" (no research behind it, off by default). The research disclaimer
 * sits under the estimate. Switches apply immediately (like the other settings screens), so
 * there is no Save; Done just leaves the page. Kit primitives only.
 */
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import { Switch } from '../../../components/ui/Switch';
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
  const master = settings.useInCalculations;
  const labels: Record<AlcoholSurface, { label: string; sub: string }> = {
    readiness: { label: t.nicSfReadiness, sub: t.nicSfReadinessSub },
    sleep: { label: t.nicSfSleep, sub: t.nicSfSleepSub },
    fatigue: { label: t.nicSfFatigue, sub: t.nicSfFatigueSub },
    progression: { label: t.nicSfProgression, sub: t.nicSfProgressionSub },
    trends: { label: t.nicSfTrends, sub: t.nicSfTrendsSub },
    afterWorkoutHints: { label: t.nicSfAfter, sub: t.alcSfAfterSub },
  };
  const row = (k: AlcoholSurface) => (
    <ListRow
      key={k}
      as="label"
      dim={!master}
      icon={<IconTile tone="neutral" size={30} icon={SURFACE_ICON[k]} />}
      label={labels[k].label}
      sub={labels[k].sub}
      trailing={
        <Switch
          checked={settings.surfaces[k] !== false}
          disabled={!master}
          onChange={(on) => setAlcoholSurface(k, on)}
          aria-label={labels[k].label}
        />
      }
    />
  );
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.nicCalcTitle}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <GroupedList footer={t.nicCalcMasterFoot}>
            <ListRow
              as="label"
              icon={<IconTile tone="accent" size={30} icon="sliders-horizontal" />}
              label={t.alcCalcMaster}
              sub={t.alcCalcMasterSub}
              trailing={
                <Switch
                  checked={master}
                  onChange={setAlcoholUseInCalculations}
                  aria-label={t.alcCalcMaster}
                />
              }
            />
          </GroupedList>
          <GroupedList header={t.nicCalcResearch} footer={t.nicCalcResearchFoot}>
            {RESEARCH.map(row)}
          </GroupedList>
          <div className="ul-flex ul-col ug-8">
            <div className="uigl-h">{t.nicCalcExperimental}</div>
            <Notice tone="neutral" icon="info">
              {t.nicCalcExpNotice}
            </Notice>
            <GroupedList>{EXPERIMENTAL.map(row)}</GroupedList>
          </div>
          <Notice tone="neutral" icon="info">
            {t.alcoholDisclaimer}
          </Notice>
        </div>
      </div>
      <StickyActionBar variant="page" surface="bg">
        <Button variant="primary" fullWidth onClick={onBack}>
          {t.done}
        </Button>
      </StickyActionBar>
    </div>
  );
}
