/**
 * Nicotine, "Use in calculations" (board 3B): the master switch plus two groups of
 * per-surface switches: "Based on research (weak)" and "Experimental" (no research, off by
 * default). Switches apply immediately (like the other settings screens), so
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
  const master = settings.useInCalculations;
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
  const row = (k: NicotineSurface) => (
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
          onChange={(on) => setNicotineSurface(k, on)}
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
              label={t.nicCalcMaster}
              sub={t.nicCalcMasterSub}
              trailing={
                <Switch
                  checked={master}
                  onChange={setNicotineUseInCalculations}
                  aria-label={t.nicCalcMaster}
                />
              }
            />
          </GroupedList>
          <GroupedList header={t.nicCalcResearch} footer={t.nicCalcResearchFoot}>
            {EVIDENCE_SURFACES.map(row)}
          </GroupedList>
          <div className="ul-flex ul-col ug-8">
            <div className="uigl-h">{t.nicCalcExperimental}</div>
            <Notice tone="neutral" icon="info">
              {t.nicCalcExpNotice}
            </Notice>
            <GroupedList>{EXPERIMENTAL_SURFACES.map(row)}</GroupedList>
          </div>
          <Notice tone="neutral" icon="info">
            {t.nicFxDisclaimer}
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
