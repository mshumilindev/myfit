/**
 * Session summary · "Without nicotine" (boards 4A and 4E). Shown under "Recovery fuel" once a
 * workout is done, never during it: what the numbers could look like without nicotine, as
 * cautious ranges in the user's own baselines (recovery gap, top set, sleep). Hidden
 * entirely when nicotine is not in use or no line has anything to say. A tap on "How is
 * this estimated?" opens the sheet of board 4E. Estimates, not medical advice.
 */
import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useT } from '../../i18n';
import type { Strings } from '../../i18n/en';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Sheet } from '../../components/ui/Overlays';
import {
  NICOTINE_SOURCES,
  baseUnitsPer,
  productAbsorbedMgPerDay,
  productMgPerDay,
  productsByLoad,
} from '../../nicotine';
import type { NicotineProduct, NicotineUnit } from '../../types';
import { nowMs } from '../logActivity/shared';
import { roundMg } from '../health/nicotine/text';
import {
  fmtRangeText,
  nicotineCardModel,
  summaryBaselines,
  type NicotineCardModel,
} from './nicotineBaselines';
import type { Workout } from '../../types';
import './FuelCard.css';
import './NicotineCard.css';

const SOURCE_LABEL = {
  absorb: 'nicSrcAbsorb',
  heated: 'nicSrcHeated',
  vape: 'nicSrcVape',
  sleep: 'nicSrcSleep',
  hrv: 'nicSrcHrv',
} as const;

/** What a product's amount is counted in on the sheet: the base unit, so mg lines up. */
export function amountOf(p: Pick<NicotineProduct, 'kind' | 'unit' | 'amount' | 'mlPerPod'>): {
  amount: number;
  unit: NicotineUnit;
} {
  const n = Math.round(p.amount * baseUnitsPer(p) * 100) / 100;
  if (p.kind === 'vape') return { amount: n, unit: 'ml' };
  if (p.unit === 'packs') return { amount: n, unit: p.kind === 'heated' ? 'sticks' : 'pieces' };
  return { amount: p.amount, unit: p.unit };
}

/**
 * "Cigarettes: 20 × 1 mg" style line: the unit first and then the amount, so no plural or
 * case has to agree with a number in any language; mg is per base unit. A product used
 * from time to time has no amount: "From time to time × 1 mg".
 */
export function productSub(
  t: Strings,
  p: Partial<Pick<NicotineProduct, 'unit' | 'amount' | 'occasional'>> &
    Pick<NicotineProduct, 'kind' | 'strengthMg'> &
    Pick<Partial<NicotineProduct>, 'mlPerPod'>,
): string {
  if (p.occasional || p.unit === undefined || p.amount === undefined)
    return t.nicFxProductSome(String(p.strengthMg));
  const a = amountOf({ kind: p.kind, unit: p.unit, amount: p.amount, mlPerPod: p.mlPerPod });
  return t.nicFxProductSub(t.nicUnit[a.unit], String(a.amount), String(p.strengthMg));
}

export function NicotineHowSheet(props: {
  model: NicotineCardModel;
  products: readonly NicotineProduct[];
  onClose: () => void;
  onOpenSettings?: () => void;
}) {
  const { t } = useT();
  const { model } = props;
  return (
    <Sheet onClose={props.onClose} className="nic-fx-sheet-host">
      <div className="nic-fx-sheet">
        <h2 className="ut-xl ut-w7">{t.nicFxHowTitle}</h2>
        <GroupedList surface="raised" header={t.nicFxHowSum}>
          {productsByLoad(props.products).map((p) => {
            return (
              <ListRow
                key={p.id}
                icon={<IconTile tone="neutral" size={30} icon="wind" />}
                label={t.nicKind[p.kind]}
                sub={
                  <>
                    <span className="ul-block">{productSub(t, p)}</span>
                    <span className="ul-block">
                      {t.nicFxLabelledMg(roundMg(productMgPerDay(p)))}
                    </span>
                  </>
                }
                value={t.nicFxAbsorbedMg(roundMg(productAbsorbedMgPerDay(p)))}
              />
            );
          })}
          <ListRow
            icon={<IconTile tone="accent" size={30} icon="gauge" />}
            label={t.nicFxLoad}
            sub={
              <>
                <span className="ul-block">{t.nicFxLoadSub}</span>
                <span className="ul-block">
                  {t.nicFxCigEq(String(Math.round(model.hints.cigEq * 10) / 10))}
                </span>
              </>
            }
            value={t.nicFxMg(roundMg(model.hints.absorbedMgPerDay))}
            valueStrong
          />
        </GroupedList>
        <GroupedList surface="raised">
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="heartbeat" />}
            label={t.nicFxOwn}
            sub={t.nicFxOwnSub}
          />
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="info" />}
            label={t.nicFxDefault}
            sub={t.nicFxDefaultSub}
          />
        </GroupedList>
        <p className="ut-xs ut-faint">{t.nicFxDisclaimer}</p>
        <GroupedList surface="raised" header={t.nicFxSourcesTitle}>
          {NICOTINE_SOURCES.map((src) => (
            <ListRow
              key={src.topic}
              icon={<IconTile tone="neutral" size={30} icon="book-open" />}
              label={t[SOURCE_LABEL[src.topic]]}
              sub={src.approx ? `${src.cite} (${t.nicSrcApprox})` : src.cite}
            />
          ))}
        </GroupedList>
        <p className="ut-xs ut-faint">{t.nicFxHowFoot}</p>
        {props.onOpenSettings && (
          <Button variant="secondary" fullWidth onClick={props.onOpenSettings}>
            {t.nicFxOpenSettings}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export function NicotineCard({
  workout,
  onOpenSettings,
}: {
  workout: Workout;
  /** Opens Health › Use in calculations; the button on the sheet shows only when given. */
  onOpenSettings?: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const now = workout.finishedAt ?? nowMs();
  const model = useMemo(() => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    return nicotineCardModel(
      store.nicotine,
      summaryBaselines(workout, finished, store.sleeps, now),
    );
  }, [store.nicotine, store.workouts, store.sleeps, workout, now]);
  if (!model) return null;

  return (
    <Card as="section" className="fuel-card" aria-labelledby="nic-fx-t">
      <SectionLabel id="nic-fx-t">{t.nicFxTitle}</SectionLabel>
      <ul className="fuel-list">
        {model.recoveryPct && (
          <li className="fuel-row" data-line="recovery">
            <IconTile tone="rest" size={36} icon="heartbeat" />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.nicFxRecoveryLabel}</p>
              <p className="ut-sm ut-dim">{t.nicFxRecovery(fmtRangeText(model.recoveryPct))}</p>
              <p className="ut-xs ut-faint" data-conf="weak">
                {t.nicConfWeak}
              </p>
            </div>
          </li>
        )}
        {model.sleepMin && (
          <li className="fuel-row" data-line="sleep">
            <IconTile tone="sleep" size={36} icon="moon" />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.nicFxSleepLabel}</p>
              <p className="ut-sm ut-dim">{t.nicFxSleep(fmtRangeText(model.sleepMin))}</p>
              <p className="ut-xs ut-faint" data-conf="weak">
                {t.nicConfWeak}
              </p>
            </div>
          </li>
        )}
      </ul>
      <p className="ut-xs ut-faint">{t.nicFxNote}</p>
      <Button
        variant="link"
        size="sm"
        icon="info"
        className="nic-fx-link"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t.nicFxHow}
      </Button>
      {open && (
        <NicotineHowSheet
          model={model}
          products={store.nicotine.products}
          onClose={() => setOpen(false)}
          onOpenSettings={
            onOpenSettings
              ? () => {
                  setOpen(false);
                  onOpenSettings();
                }
              : undefined
          }
        />
      )}
    </Card>
  );
}
