/**
 * Supplements, "Use in calculations" (the alcohol / nicotine pattern): the master switch and
 * one switch per surface (strength expectation, sleep, RPE note, protein target, trends,
 * after-workout hints), each with its evidence tag; then the disclaimer and the sources.
 * Switches apply immediately, so there is no Save; Done just leaves the page. Kit only.
 */
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import { Switch } from '../../../components/ui/Switch';
import { Tag } from '../../../components/ui/Tag';
import {
  SUPPLEMENT_COEFFS,
  SUPPLEMENT_SURFACES,
  EXPERIMENTAL_SURFACES,
  SUPPLEMENT_EFFECT_KEYS,
  isExperimentalSurface,
  type SupplementConfidence,
} from '../../../supplements';
import {
  setSupplementSurface,
  setSupplementUseInCalculations,
  useSupplements,
} from '../../../store';
import type { SupplementSurface } from '../../../types';
import { SupplementSourceList } from './SupplementSources';
import { EVIDENCE_TONE, useSupplementText } from './text';

const SURFACE_ICON: Record<SupplementSurface, string> = {
  strength: 'barbell',
  sleep: 'moon',
  rpe: 'gauge',
  protein: 'egg',
  trends: 'chart-line',
  afterWorkoutHints: 'flag-checkered',
};

const RESEARCH = SUPPLEMENT_SURFACES.filter((k) => !isExperimentalSurface(k));

const RANK: Record<SupplementConfidence, number> = { strong: 3, moderate: 2, weak: 1, none: 0 };

/** The best evidence among the numbers a surface carries (None when it carries no number). */
export function surfaceEvidence(s: SupplementSurface): SupplementConfidence {
  let best: SupplementConfidence = 'none';
  for (const k of SUPPLEMENT_EFFECT_KEYS) {
    const c = SUPPLEMENT_COEFFS[k];
    if (c.surface === s && RANK[c.confidence] > RANK[best]) best = c.confidence;
  }
  return best;
}

export function SupplementCalcView({ onBack }: { onBack: () => void }) {
  const { t } = useSupplementText();
  const { settings } = useSupplements();
  const master = settings.useInCalculations;
  const row = (k: SupplementSurface) => {
    const ev = surfaceEvidence(k);
    return (
      <ListRow
        key={k}
        as="label"
        dim={!master}
        icon={<IconTile tone="neutral" size={30} icon={SURFACE_ICON[k]} />}
        label={t.supSf[k].label}
        sub={
          <span className="ul-flex ul-col ug-4">
            <span>{t.supSf[k].sub}</span>
            <span className="ul-flex">
              <Tag tone={EVIDENCE_TONE[ev]}>{t.supEvidence[ev]}</Tag>
            </span>
          </span>
        }
        trailing={
          <Switch
            checked={settings.surfaces[k] !== false}
            disabled={!master}
            onChange={(on) => setSupplementSurface(k, on)}
            aria-label={t.supSf[k].label}
          />
        }
      />
    );
  };
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.supCalcTitle}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <GroupedList footer={t.nicCalcMasterFoot}>
            <ListRow
              as="label"
              icon={<IconTile tone="accent" size={30} icon="sliders-horizontal" />}
              label={t.supCalcMaster}
              sub={t.supCalcMasterSub}
              trailing={
                <Switch
                  checked={master}
                  onChange={setSupplementUseInCalculations}
                  aria-label={t.supCalcMaster}
                />
              }
            />
          </GroupedList>
          <GroupedList header={t.supCalcSurfaces} footer={t.supCalcSurfacesFoot}>
            {RESEARCH.map(row)}
          </GroupedList>
          {EXPERIMENTAL_SURFACES.length > 0 && (
            <div className="ul-flex ul-col ug-8">
              <div className="uigl-h">{t.nicCalcExperimental}</div>
              <Notice tone="neutral" icon="info">
                {t.nicCalcExpNotice}
              </Notice>
              <GroupedList>{EXPERIMENTAL_SURFACES.map(row)}</GroupedList>
            </div>
          )}
          <Notice tone="neutral" icon="info">
            {t.supDisclaimer}
          </Notice>
          <SupplementSourceList />
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
