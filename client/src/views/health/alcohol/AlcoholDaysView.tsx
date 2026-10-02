/**
 * Alcohol, "Usual days": the weekdays you usually drink on (optional, several at once). After
 * those days the app asks on Today whether you drank, so the numbers follow what really
 * happened. Save is disabled until the choice changed; with nothing picked the weekly amount
 * is spread evenly. Kit primitives only.
 */
import { useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { PresetChips } from '../../../components/ui/PresetChips';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { StickyActionBar } from '../../../components/ui/StickyActionBar';
import { WEEKDAYS, cleanUsualDays } from '../../../alcohol';
import { setAlcoholUsualDays, useAlcohol } from '../../../store';
import { useAlcoholText } from './text';

export function AlcoholDaysView({ onBack }: { onBack: () => void }) {
  const { t } = useAlcoholText();
  const { settings } = useAlcohol();
  const [days, setDays] = useState<number[]>(() => cleanUsualDays(settings.usualDays));
  const dirty = days.join() !== cleanUsualDays(settings.usualDays).join();
  const toggle = (d: number) =>
    setDays((cur) => cleanUsualDays(cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const save = () => {
    if (!dirty) return;
    setAlcoholUsualDays(days);
    onBack();
  };
  return (
    <div className="screen hl">
      <div className="hl-pbar">
        <BackButton label={t.backAction} onClick={onBack} />
        <h1 className="hl-pt">{t.alcHubDays}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">
          <span className="ut-md ut-muted">{t.alcDaysIntro}</span>
          <div className="ul-flex ul-col ug-8">
            <SectionLabel>{t.alcDaysHead}</SectionLabel>
            <PresetChips
              layout="grid"
              label={t.alcDaysHead}
              items={WEEKDAYS.map((d) => ({
                id: String(d),
                label: t.alcDays[d],
                selected: days.includes(d),
                onClick: () => toggle(d),
              }))}
            />
            <span className="ut-sm ut-muted">{t.alcDaysFoot}</span>
          </div>
        </div>
      </div>
      <StickyActionBar variant="page" surface="bg">
        <Button variant="primary" fullWidth disabled={!dirty} onClick={save}>
          {t.nicSave}
        </Button>
      </StickyActionBar>
    </div>
  );
}
