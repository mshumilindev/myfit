/**
 * Today · "Did you have a drink on Saturday?" One compact card, shown only while a check-in
 * is pending (`usePendingAlcoholCheckin`: usual days set, a usual drinking day with no
 * answer, at most 3 days back). Three answers: No / Usual (≈ N g) / Different amount (a sheet
 * with the amount in the region's standard drinks, converted to grams). "Not now" hides the
 * card for the rest of today without answering. Nothing about alcohol is shown anywhere else
 * in a session. Kit only.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { IconTile } from './ui/IconTile';
import { NumberStepper } from './ui/NumberStepper';
import { Sheet } from './ui/Overlays';
import { dayKey, weekdayIndex } from '../alcohol';
import { regionInfo } from '../alcoholRegion';
import { nowMs } from '../views/logActivity/shared';
import { answerAlcoholDay, useAlcoholRegion, usePendingAlcoholCheckin } from '../store';

const SKIP_KEY = 'spotter.alcCheckSkip';

/** The day the card was last put away with "Not now" (a per-device convenience). */
function skippedOn(): string | null {
  try {
    return localStorage.getItem(SKIP_KEY);
  } catch {
    return null;
  }
}
function rememberSkip(day: string): void {
  try {
    localStorage.setItem(SKIP_KEY, day);
  } catch {
    /* no storage: the card only hides until the next render */
  }
}

const roundG = (g: number): number => (g < 10 ? Math.round(g * 10) / 10 : Math.round(g));

function AmountSheet({
  date,
  usualGrams,
  onClose,
}: {
  date: string;
  usualGrams: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const info = regionInfo(useAlcoholRegion());
  const start = Math.max(0.5, Math.round((usualGrams / info.gramsPerDrink) * 2) / 2);
  const [drinks, setDrinks] = useState(start);
  const grams = roundG(drinks * info.gramsPerDrink);
  const dirty = drinks !== start;
  const save = () => {
    if (!dirty) return;
    answerAlcoholDay(date, { kind: 'custom', grams });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <h2 className="ut-xl ut-w7">{t.alcCheckSheetTitle}</h2>
        <NumberStepper
          label={t.alcCheckAmount}
          value={drinks}
          onChange={setDrinks}
          step={0.5}
          decimals={1}
          min={0.5}
          max={60}
          unit={t.alcCheckUnit(info.drinkWord)}
        />
        <span className="ut-sm ut-muted">{`${t.alcCheckReadout} ${t.alcGrams(grams)}`}</span>
        <Button variant="primary" fullWidth disabled={!dirty} onClick={save}>
          {t.save}
        </Button>
      </div>
    </Sheet>
  );
}

export function AlcoholCheckinCard() {
  const { t } = useT();
  const pending = usePendingAlcoholCheckin();
  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (!pending || hidden) return null;
  if (skippedOn() === dayKey(nowMs())) return null;
  const wd = weekdayIndex(pending.date);
  if (wd === null) return null;
  return (
    <Card as="section" tone="neutral" aria-labelledby="alc-check-t" data-testid="alc-checkin">
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="neutral" size={36} icon="wine" />
          <div className="ul-flex ul-col ug-4 uf-1">
            <div id="alc-check-t" className="ut-base ut-w6">
              {t.alcCheckTitle(t.alcCheckOn[wd])}
            </div>
            <div className="ut-sm ut-muted">{t.alcCheckSub}</div>
          </div>
        </div>
        <div
          className="ul-flex ul-wrap ug-8"
          role="group"
          aria-label={t.alcCheckTitle(t.alcCheckOn[wd])}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => answerAlcoholDay(pending.date, { kind: 'none' })}
          >
            {t.alcCheckNo}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => answerAlcoholDay(pending.date, { kind: 'usual' })}
          >
            {t.alcCheckUsual(roundG(pending.usualGrams))}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>
            {t.alcCheckOther}
          </Button>
        </div>
        <div className="ul-flex">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              rememberSkip(dayKey(nowMs())!);
              setHidden(true);
            }}
          >
            {t.alcCheckSkip}
          </Button>
        </div>
      </div>
      {sheet && (
        <AmountSheet
          date={pending.date}
          usualGrams={pending.usualGrams}
          onClose={() => setSheet(false)}
        />
      )}
    </Card>
  );
}
