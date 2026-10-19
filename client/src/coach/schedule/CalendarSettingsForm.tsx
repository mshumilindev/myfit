import { useId, useState } from 'react';
import './Schedule.css';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { GymPicker } from '../../components/GymPicker';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useStore } from '../../store';
import { useT } from '../../i18n';
import { Notice } from '../../components/ui/Notice';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { TimeField } from '../../components/ui/TimeField';
import type { LocaleId } from '../../i18n';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { PanelFooter } from '../layout/footerSlot';
import { useCalendarSettings } from './calendarSettings';
import { useGymWeeks } from './gymHours';
import {
  gymSummary,
  is24x7,
  type CalendarSettings,
  type GymWeek,
  type RangeMode,
  type WeekHours,
} from './hours';
import { longWeekday, shortWeekday } from './labels';
import { fromMin, toMin, weekStartDay } from './time';
import { hasGymSource, scheduleGyms } from './types';

export interface CalendarSettingsFormProps {
  t: ScheduleStrings;
  locale: LocaleId;
  /** a day key of the week the weekday names are taken from */
  today: number;
  onClose: () => void;
}

/** "06:00–23:00", "24/7" or the unknown-hours line; weekends are added when they differ from Monday. */
function gymLine(week: GymWeek | null | undefined, t: ScheduleStrings): string {
  if (!week) return t.hsGymNoHours;
  if (is24x7(week)) return t.hsGym24;
  const mon = gymSummary(week, 0);
  const sat = gymSummary(week, 5);
  return [mon, sat && sat !== mon ? `${t.scWeekendShort} ${sat}` : null]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Calendar settings (a coach drawer): the trainer's working hours per weekday, the gyms they work at and the visible
 * range of the grid (Auto / Working hours / 24 h). Kit controls only; Save is sealed with the trainer's own key.
 */
export function CalendarSettingsForm(p: CalendarSettingsFormProps) {
  const { t, locale } = p;
  const formId = useId();
  const cur = useCalendarSettings();
  const gyms = scheduleGyms();
  const weeks = useGymWeeks(gyms);
  const [draft, setDraft] = useState<CalendarSettings>(cur.settings);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const store = useStore();
  const { t: tApp } = useT();
  const [failed, setFailed] = useState(false);
  const monday = weekStartDay(p.today);
  const set = (patch: Partial<CalendarSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const setDay = (i: number, v: WeekHours[number]) =>
    set({ working: draft.working.map((x, k) => (k === i ? v : x)) });
  const bad = draft.working.some((d) => d && d.end - d.start < 60);
  const toggleGym = (id: string) =>
    set({
      gymIds: draft.gymIds.includes(id)
        ? draft.gymIds.filter((x) => x !== id)
        : [...draft.gymIds, id],
    });
  const save = async () => {
    // Enter in a field submits the form even while the Save button is disabled
    if (bad || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await cur.save(draft);
    setBusy(false);
    if (ok) p.onClose();
    else setFailed(true);
  };
  const rangeHint =
    draft.range === '24h'
      ? t.hsRange24
      : draft.range === 'working'
        ? t.hsRangeWorking
        : t.hsRangeAuto;

  return (
    <form
      id={formId}
      className="sc-form"
      aria-label={t.hsTitle}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="sc-form-sub">{t.hsSub}</p>

      <div className="sc-form-block">
        <Segmented
          label={t.hsRange}
          fill
          value={draft.range}
          onChange={(range: RangeMode) => set({ range })}
          options={[
            { value: 'auto', label: t.hsAuto },
            { value: 'working', label: t.hsWorking },
            { value: '24h', label: t.hs24 },
          ]}
        />
        <p className="sc-form-hint" role="status">
          {rangeHint}
        </p>
      </div>

      <section className="sc-set" aria-labelledby={`${formId}-h`}>
        <SectionLabel id={`${formId}-h`}>{t.hsHours}</SectionLabel>
        <GroupedList surface="raised" className="sc-hrs" label={t.hsHours}>
          {draft.working.map((d, i) => {
            const day = longWeekday(monday + i, locale);
            return (
              <ListRow
                key={i}
                as="div"
                dense
                className="sc-hrs-row"
                label={shortWeekday(monday + i, locale)}
                labelFixed
                trailing={
                  <Switch
                    size="sm"
                    checked={!!d}
                    aria-label={day}
                    onChange={(on) => setDay(i, on ? { start: 7 * 60, end: 21 * 60 } : null)}
                  />
                }
              >
                {d ? (
                  <span className="sc-hrs-times">
                    <TimeField
                      size="sm"
                      aria-label={`${day}: ${t.hsFrom}`}
                      value={fromMin(d.start)}
                      step={900}
                      onChange={(e) =>
                        e.target.value && setDay(i, { ...d, start: toMin(e.target.value) })
                      }
                    />
                    <span aria-hidden="true">–</span>
                    <TimeField
                      size="sm"
                      aria-label={`${day}: ${t.hsTo}`}
                      value={d.end >= 1440 ? '23:59' : fromMin(d.end)}
                      step={900}
                      onChange={(e) =>
                        e.target.value &&
                        setDay(i, { ...d, end: Math.max(toMin(e.target.value), 1) })
                      }
                    />
                  </span>
                ) : (
                  <span className="sc-hrs-off">{t.hsDayOff}</span>
                )}
              </ListRow>
            );
          })}
        </GroupedList>
        {bad && (
          <p className="sc-form-err" role="alert">
            {t.hsOrder}
          </p>
        )}
      </section>

      <section className="sc-set" aria-labelledby={`${formId}-g`}>
        <SectionLabel
          id={`${formId}-g`}
          action={
            gyms.length > 0 ? (
              <span className="sc-set-meta">
                {t.hsGymsCount(
                  draft.gymIds.filter((id) => gyms.some((g) => g.id === id)).length,
                  gyms.length,
                )}
              </span>
            ) : undefined
          }
        >
          {t.hsGyms}
        </SectionLabel>
        {gyms.length === 0 ? (
          <p className="sc-form-hint">{t.hsNoGyms}</p>
        ) : (
          <GroupedList surface="raised" className="sc-gyms" label={t.hsGyms}>
            {gyms.map((g) => (
              <ListRow
                key={g.id}
                as="label"
                dense
                icon={
                  <Checkbox
                    checked={draft.gymIds.includes(g.id)}
                    onChange={() => toggleGym(g.id)}
                    aria-label={g.name}
                  />
                }
                label={g.name}
                sub={gymLine(weeks.get(g.id), t)}
                selected={draft.gymIds.includes(g.id)}
              />
            ))}
          </GroupedList>
        )}
        <p className="sc-form-hint">{t.hsGymsHint}</p>
        {draft.gymIds.length === 0 && gyms.length > 0 && (
          <p className="sc-form-hint">{t.hsGymsNone}</p>
        )}
        {hasGymSource() && (
          <Button variant="secondary" type="button" icon="plus" onClick={() => setAdding(true)}>
            {t.hsGymsAdd}
          </Button>
        )}
      </section>
      {adding && (
        <GymPicker
          gyms={store.gyms}
          title={tApp.pickGymTitle}
          onClose={() => setAdding(false)}
          onPick={(id) => {
            setAdding(false);
            if (id && !draft.gymIds.includes(id)) set({ gymIds: [...draft.gymIds, id] });
          }}
        />
      )}

      {failed && (
        <Notice tone="danger" icon="warning" role="alert">
          {t.hsFail}
        </Notice>
      )}
      <PanelFooter>
        <Button variant="secondary" type="button" onClick={p.onClose}>
          {t.bdCancel}
        </Button>
        <Button type="submit" form={formId} loading={busy} disabled={busy || bad} icon="check">
          {t.hsSave}
        </Button>
      </PanelFooter>
    </form>
  );
}
