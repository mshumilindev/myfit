/**
 * Today · "Did you take your supplements today?" One grouped card for the day, shown only
 * while a check-in is pending (`getPendingSupplementCheckin`: check-ins on, something due,
 * from the evening hour for today, at most 3 days back, one day at a time). Three answers:
 * All / Some… (a sheet with a checklist; Save only once something changed) / None. "Not now"
 * hides the card for the rest of today without answering. The answer replaces the "everything
 * due was taken" assumption in the supplement estimates. Kit only.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Checkbox } from './ui/Checkbox';
import { GroupedList, ListRow } from './ui/GroupedList';
import { IconTile } from './ui/IconTile';
import { Sheet } from './ui/Overlays';
import { addDays, dayKey, weekdayIndex } from '../supplements';
import { supplementContext } from '../supplementsApply';
import { supDoseText, supName, supNamesLine } from '../supplementsText';
import { supplementItem } from '../supplementCatalog';
import { nowMs } from '../views/logActivity/shared';
import { answerSupplementDay, getPendingSupplementCheckin, useSupplements } from '../store';
import type { SupplementEntry } from '../types';

const SKIP_KEY = 'spotter.supCheckSkip';

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

function SomeSheet({
  date,
  entries,
  onClose,
}: {
  date: string;
  entries: SupplementEntry[];
  onClose: () => void;
}) {
  const { t } = useT();
  const initial = entries.map((e) => e.id);
  const [picked, setPicked] = useState<string[]>(initial);
  const dirty = picked.length !== initial.length || initial.some((id) => !picked.includes(id));
  const toggle = (id: string, on: boolean) =>
    setPicked((cur) => (on ? [...cur.filter((x) => x !== id), id] : cur.filter((x) => x !== id)));
  const save = () => {
    if (!dirty) return;
    answerSupplementDay(date, { kind: 'some', entryIds: picked });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12">
        <h2 className="ut-xl ut-w7">{t.supTdSheetTitle}</h2>
        <span className="ut-sm ut-muted">{t.supTdSheetSub}</span>
        <GroupedList surface="raised">
          {entries.map((e) => {
            const name = supName(t, e.itemId);
            return (
              <ListRow
                key={e.id}
                as="label"
                icon={<IconTile tone="neutral" size={30} icon={supplementItem(e.itemId).icon} />}
                label={name}
                sub={`${supDoseText(t, e.dose, supplementItem(e.itemId).unit)} · ${t.supFxTiming[e.timing]}`}
                trailing={
                  <Checkbox
                    checked={picked.includes(e.id)}
                    onChange={(on) => toggle(e.id, on)}
                    aria-label={name}
                  />
                }
              />
            );
          })}
        </GroupedList>
        <Button variant="primary" fullWidth disabled={!dirty} onClick={save}>
          {t.save}
        </Button>
      </div>
    </Sheet>
  );
}

export function SupplementCheckinCard() {
  const { t } = useT();
  const sup = useSupplements();
  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden || !sup.entries.length) return null;
  const now = nowMs();
  const pending = getPendingSupplementCheckin(supplementContext(now), now);
  if (!pending) return null;
  const today = dayKey(now);
  if (!today || skippedOn() === today) return null;
  const wd = weekdayIndex(pending.date);
  const title =
    pending.date === today
      ? t.supTdTitleToday
      : pending.date === addDays(today, -1)
        ? t.supTdTitleYesterday
        : wd === null
          ? t.supTdTitleToday
          : t.supTdTitleOn(t.alcCheckOn[wd]);
  return (
    <Card as="section" tone="neutral" aria-labelledby="sup-check-t" data-testid="sup-checkin">
      <div className="ul-flex ul-col ug-12">
        <div className="ul-flex ua-center ug-12">
          <IconTile tone="neutral" size={36} icon="pill" />
          <div className="ul-flex ul-col ug-4 uf-1">
            <div id="sup-check-t" className="ut-base ut-w6">
              {title}
            </div>
            <div className="ut-sm ut-muted">{supNamesLine(t, pending.entries)}</div>
          </div>
        </div>
        <div className="ul-flex ul-wrap ug-8" role="group" aria-label={title}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => answerSupplementDay(pending.date, { kind: 'all' })}
          >
            {t.supTdAll}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>
            {t.supTdSome}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => answerSupplementDay(pending.date, { kind: 'none' })}
          >
            {t.supTdNone}
          </Button>
        </div>
        <div className="ul-flex ua-center ug-12">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              rememberSkip(today);
              setHidden(true);
            }}
          >
            {t.supTdSkip}
          </Button>
          <span className="ut-xs ut-faint">{t.supTdSub}</span>
        </div>
      </div>
      {sheet && (
        <SomeSheet date={pending.date} entries={pending.entries} onClose={() => setSheet(false)} />
      )}
    </Card>
  );
}
