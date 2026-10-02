/**
 * Session summary · "Your supplements". A light information card under the nicotine and
 * alcohol cards, shown ONLY when something applies today: the creatine strength expectation
 * (and its body-weight note) or the caffeine effort note. It is information, not a warning:
 * neutral tiles, no evidence tags, no tone. This app never changes a load or a target because
 * of a supplement, and the card says so. "How is this estimated?" opens the sheet with the
 * supplements, the rules, the disclaimer and the sources. Kit only; the layout is the Recovery
 * fuel card's (FuelCard.css).
 */
import { useMemo, useState } from 'react';
import { useSupplements, getSupplementEffectsFor } from '../../store';
import { useT } from '../../i18n';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Sheet } from '../../components/ui/Overlays';
import {
  activeSupplementEntries,
  supplementItem,
  SUPPLEMENT_SOURCES,
} from '../../supplementCatalog';
import type { SupplementSourceKey } from '../../supplementCatalog';
import { supplementContext } from '../../supplementsApply';
import { supNamesLine } from '../../supplementsText';
import { fmtRangeText } from './nicotineBaselines';
import { supplementCardModel, type SupplementCardModel } from './supplementCardModel';
import type { Workout } from '../../types';
import './FuelCard.css';
import './NicotineCard.css';

/** Sources behind the lines shown, plus those of the items the user takes. */
function sourcesFor(
  model: SupplementCardModel | null,
  entries: ReturnType<typeof activeSupplementEntries>,
) {
  const keys = new Set<SupplementSourceKey>();
  if (model?.strengthPct || model?.weightKg) keys.add('creatine');
  if (model?.rpe) keys.add('caffeine');
  for (const e of entries) {
    const s = supplementItem(e.itemId).source;
    if (s) keys.add(s);
  }
  return [...keys];
}

export function SupplementsHowSheet(props: {
  onClose: () => void;
  onOpenSettings?: () => void;
  model?: SupplementCardModel | null;
}) {
  const { t } = useT();
  const { entries } = useSupplements();
  const active = activeSupplementEntries(entries);
  return (
    <Sheet onClose={props.onClose} className="nic-fx-sheet-host">
      <div className="nic-fx-sheet">
        <h2 className="ut-xl ut-w7">{t.nicFxHowTitle}</h2>
        {active.length > 0 && (
          <GroupedList surface="raised" header={t.supFxTitle}>
            <ListRow
              icon={<IconTile tone="neutral" size={30} icon="pill" />}
              label={supNamesLine(t, active)}
            />
          </GroupedList>
        )}
        <GroupedList surface="raised">
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="calendar-dots" />}
            label={t.supFxRampLabel}
            sub={t.supFxRampSub}
          />
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="lightning" />}
            label={t.supFxCaffLabel}
            sub={t.supFxCaffSub}
          />
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="info" />}
            label={t.supFxNoChangeLabel}
            sub={t.supFxNoChangeSub}
          />
        </GroupedList>
        <p className="ut-xs ut-faint">{t.supFxDisclaimer}</p>
        <GroupedList surface="raised" header={t.nicFxSourcesTitle}>
          {sourcesFor(props.model ?? null, active).map((key) => (
            <ListRow
              key={key}
              icon={<IconTile tone="neutral" size={30} icon="book-open" />}
              label={t.supFxSrc[key]}
              sub={
                SUPPLEMENT_SOURCES[key].approx
                  ? `${SUPPLEMENT_SOURCES[key].cite} (${t.nicSrcApprox})`
                  : SUPPLEMENT_SOURCES[key].cite
              }
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

export function SupplementsCard({
  workout,
  onOpenSettings,
}: {
  workout: Workout;
  /** Opens Health › Supplements › Use in calculations; the button on the sheet shows only when given. */
  onOpenSettings?: () => void;
}) {
  const { t } = useT();
  const sup = useSupplements();
  const [open, setOpen] = useState(false);
  const model = useMemo(
    () =>
      supplementCardModel(
        getSupplementEffectsFor(workout.startedAt, supplementContext(workout.startedAt)),
        sup.settings,
      ),
    // `sup` is a stable object until something changes.
    [sup, workout.startedAt],
  );
  if (!model) return null;

  return (
    <Card as="section" className="fuel-card" aria-labelledby="sup-fx-t" data-testid="sup-fx-card">
      <SectionLabel id="sup-fx-t">{t.supFxTitle}</SectionLabel>
      <ul className="fuel-list">
        {model.strengthPct && (
          <li className="fuel-row" data-line="strength">
            <IconTile tone="neutral" size={36} icon="barbell" />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.supFxStrengthLabel}</p>
              <p className="ut-sm ut-dim">{t.supFxStrength(fmtRangeText(model.strengthPct))}</p>
            </div>
          </li>
        )}
        {model.weightKg && (
          <li className="fuel-row" data-line="weight">
            <IconTile tone="neutral" size={36} icon="scales" />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.supFxWeightLabel}</p>
              <p className="ut-sm ut-dim">{t.supFxWeight(fmtRangeText(model.weightKg, 1))}</p>
            </div>
          </li>
        )}
        {model.rpe && (
          <li className="fuel-row" data-line="rpe">
            <IconTile tone="neutral" size={36} icon="gauge" />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.supFxRpeLabel}</p>
              <p className="ut-sm ut-dim">{t.supFxRpe(fmtRangeText(model.rpe, 1))}</p>
            </div>
          </li>
        )}
      </ul>
      <p className="ut-xs ut-faint">{t.supFxNote}</p>
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
        <SupplementsHowSheet
          model={model}
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
