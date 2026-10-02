/**
 * Session summary · "Without alcohol". Sits under the nicotine card (or under Recovery fuel)
 * once a workout is done. Shown ONLY when alcohol changes today's numbers (the day after a
 * usual drinking day or a check-in; readiness and sleep need, both weak evidence): otherwise
 * nothing at all, so a day without alcohol stays tidy. "How is this estimated?" opens the
 * sheet with the drinks, the research disclaimer and the sources. Estimates, not medical
 * advice. Kit only; the layout is the Recovery fuel card's (FuelCard.css).
 */
import { useMemo, useState } from 'react';
import { useAlcohol, getAlcoholEffectsFor } from '../../store';
import { useT } from '../../i18n';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Sheet } from '../../components/ui/Overlays';
import { ALCOHOL_SOURCES } from '../../alcohol';
import { useAlcoholText } from '../health/alcohol/text';
import { fmtRangeText } from './nicotineBaselines';
import { alcoholCardModel } from './alcoholCardModel';
import type { Workout } from '../../types';
import './FuelCard.css';
import './NicotineCard.css';

export function AlcoholHowSheet(props: { onClose: () => void; onOpenSettings?: () => void }) {
  const { t, summary } = useAlcoholText();
  const { entries } = useAlcohol();
  return (
    <Sheet onClose={props.onClose} className="nic-fx-sheet-host">
      <div className="nic-fx-sheet">
        <h2 className="ut-xl ut-w7">{t.nicFxHowTitle}</h2>
        <GroupedList surface="raised" header={t.alcFxHowSum}>
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="wine" />}
            label={summary(entries) ?? t.alcRowEmpty}
          />
        </GroupedList>
        <GroupedList surface="raised">
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="calendar-dots" />}
            label={t.alcFxWhen}
            sub={t.alcFxWhenSub}
          />
          <ListRow
            icon={<IconTile tone="neutral" size={30} icon="info" />}
            label={t.nicFxDefault}
            sub={t.nicFxDefaultSub}
          />
        </GroupedList>
        <p className="ut-xs ut-faint">{t.alcoholDisclaimer}</p>
        <GroupedList surface="raised" header={t.nicFxSourcesTitle}>
          {ALCOHOL_SOURCES.map((src) => (
            <ListRow
              key={src.topic}
              icon={<IconTile tone="neutral" size={30} icon="book-open" />}
              label={t.alcSrc[src.topic]}
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

export function AlcoholCard({
  workout,
  onOpenSettings,
}: {
  workout: Workout;
  /** Opens Health › Alcohol › Use in calculations; the button on the sheet shows only when given. */
  onOpenSettings?: () => void;
}) {
  const { t } = useT();
  const alcohol = useAlcohol();
  const [open, setOpen] = useState(false);
  const model = useMemo(
    () => alcoholCardModel(getAlcoholEffectsFor(workout.startedAt), alcohol.settings),
    // `alcohol` is a stable object until something changes.
    [alcohol, workout.startedAt],
  );
  if (!model) return null;

  return (
    <Card as="section" className="fuel-card" aria-labelledby="alc-fx-t">
      <SectionLabel id="alc-fx-t">{t.alcFxTitle}</SectionLabel>
      <ul className="fuel-list">
        {model.recoveryPct && (
          <li className="fuel-row" data-line="recovery">
            <IconTile tone="rest" size={36} icon="heartbeat" />
            <div className="fuel-body">
              <p className="ut-base ut-w6">{t.nicFxRecoveryLabel}</p>
              <p className="ut-sm ut-dim">{t.alcFxRecovery(fmtRangeText(model.recoveryPct))}</p>
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
              <p className="ut-sm ut-dim">{t.alcFxSleep(fmtRangeText(model.sleepMin))}</p>
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
        <AlcoholHowSheet
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
