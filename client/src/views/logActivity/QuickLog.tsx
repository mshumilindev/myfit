/**
 * Quick-log (design m03/m04 sheet on mobile, w02/w03 side panel on web):
 * duration presets, When (Now / Earlier today / Pick a day with a month
 * calendar), distance + pace for distance types, effort, a live kcal estimate,
 * the pin toggle, and Start timer (Now only) / Log it.
 */
import { Button, IconButton } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useMemo, useState } from 'react';
import {
  latestWeight,
  logActivity,
  startActivity,
  updateActivity,
  useActivityPins,
  togglePin,
  useStore,
} from '../../store';
import { activityType, durationMin, estimateCalories } from '../../activities';
import { activityDays, dayStart, minuteOfDay, paceStr, roundDuration } from '../../activitySuggest';
import { fmtDayMonth, fmtMonthYear, fmtWeekday, fmtWeekdayShort, useT } from '../../i18n';

import { Icon } from '../../ui';
import { Calendar, CalendarLegend } from '../../components/ui/Calendar';
import { dayOfTimestamp, timestampOfDay } from '../../components/ui/calendarDays';
import { PinToggle } from '../../components/ui/PinToggle';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import type { Tone } from '../../components/ui/tones';
import type { Activity, ActivityEffort } from '../../types';
import {
  catOf,
  catTone,
  fmtDur,
  fmtKm,
  hhmm,
  KIT_OF,
  kitTone,
  minToHhmm,
  nowMs,
  toneClass,
  typeIcon,
  typeName,
} from './shared';
import { Tag } from '../../components/ui/Tag';

const PRESETS = [15, 30, 45, 60, 90];
const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];
const MIN = 60_000;
type When = 'now' | 'earlier' | 'day';

export interface QuickLogProps {
  typeKey: string;
  /** "Other sport" logged under the user's own name. */
  note?: string | null;
  initialMinutes?: number;
  /** A workout / activity / sleep is live → starting is locked, past logs allowed. */
  locked: boolean;
  variant: 'sheet' | 'panel';
  onClose: () => void;
  onLogged: (a: Activity) => void;
  onStarted: () => void;
}

export function QuickLog(props: QuickLogProps) {
  const { t, locale } = useT();
  const store = useStore();
  const pins = useActivityPins();
  const type = activityType(props.typeKey)!;
  const web = props.variant === 'panel';
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const [now] = useState(() => Date.now());

  const last = useMemo(() => {
    let best: Activity | undefined;
    for (const a of store.activities)
      if (a.type === type.key && a.finishedAt !== null && (!best || a.startedAt > best.startedAt))
        best = a;
    return best;
  }, [store.activities, type.key]);

  const startMinutes = props.initialMinutes ?? (last ? roundDuration(durationMin(last)) || 30 : 30);
  const [minutes, setMinutes] = useState(startMinutes);
  const [custom, setCustom] = useState(!PRESETS.includes(startMinutes));
  const [when, setWhen] = useState<When>(props.locked ? 'earlier' : 'now');
  // Earlier today: the usual start (last log's time) if it fits before now,
  // else the latest quarter-hour that still ends by now.
  const [time, setTime] = useState(() => {
    const nowMin = minuteOfDay(now);
    const lastMin = last ? minuteOfDay(last.startedAt) : null;
    if (lastMin != null && lastMin + startMinutes <= nowMin) return minToHhmm(lastMin);
    return minToHhmm(Math.max(0, Math.floor((nowMin - startMinutes) / 15) * 15));
  });
  const [day, setDay] = useState(() => {
    const d = new Date(dayStart(now));
    d.setDate(d.getDate() - 1);
    return d.getTime();
  });
  const [distance, setDistance] = useState(
    type.tracksDistance && last?.distanceKm ? fmtKm(last.distanceKm) : '',
  );
  const [effort, setEffort] = useState<ActivityEffort>(last?.effort ?? 'moderate');

  const [hh, mm] = time.split(':').map(Number);
  const startedAt =
    when === 'now'
      ? now - minutes * MIN
      : (when === 'earlier' ? dayStart(now) : day) + ((hh || 0) * 60 + (mm || 0)) * MIN;
  const finishedAt = startedAt + minutes * MIN;
  const future = when !== 'now' && finishedAt > nowMs() + MIN;
  const km = type.tracksDistance ? Number(distance.replace(',', '.')) || null : null;
  const kcal = estimateCalories(type, minutes, bodyKg, effort);
  const met = kcal != null && bodyKg ? kcal / (bodyKg * (minutes / 60)) : null;
  const pace = paceStr(minutes, km);
  const pinned = pins.includes(type.key);
  const tone = toneClass(type.key);
  const kt = kitTone(type.key);
  const title = props.note || typeName(type.key, t);
  const range = `${hhmm(startedAt)}–${hhmm(finishedAt)}`;

  function log(): void {
    if (future || minutes <= 0) return;
    const a = logActivity({
      type: type.key,
      category: type.category,
      startedAt,
      finishedAt,
      durationMin: minutes,
      calories: kcal,
      distanceKm: km,
      effort,
      note: props.note ?? null,
    });
    props.onLogged(a);
  }
  function start(): void {
    if (props.locked || when !== 'now') return;
    const a = startActivity(type.key, type.category);
    if (!a) return;
    if (effort !== 'moderate' || km || props.note)
      updateActivity(a.id, { effort, distanceKm: km, note: props.note ?? null });
    props.onStarted();
  }

  const lastLine = last
    ? t.laLastLine(
        [
          last.distanceKm ? `${fmtKm(last.distanceKm)} ${t.laKm}` : null,
          fmtDur(durationMin(last), t),
          last.distanceKm ? null : t.actEffortLevel[last.effort ?? 'moderate'],
          `${fmtWeekdayShort(last.startedAt, locale)} ${fmtDayMonth(last.startedAt, locale)}`,
        ]
          .filter(Boolean)
          .join(' · '),
      )
    : null;

  const dayLabel =
    when === 'earlier'
      ? t.laTodayLower
      : `${fmtWeekdayShort(day, locale)} ${fmtDayMonth(day, locale)}`;
  const daysAgo = Math.round((dayStart(now) - dayStart(startedAt)) / 86_400_000);
  const ago = daysAgo <= 0 ? t.laTodayLower : daysAgo === 1 ? t.laYesterday : t.laDaysAgo(daysAgo);

  const durationBlock = (
    <div className="la-blk">
      <p className="la-fl" id="ql-dur">
        {t.laDurationMin}
      </p>
      <Segmented
        variant="buttons"
        tone={kt}
        labelledBy="ql-dur"
        value={custom ? 'custom' : PRESETS.includes(minutes) ? minutes : null}
        onChange={(v) => {
          if (v === 'custom') setCustom(true);
          else {
            setCustom(false);
            setMinutes(v);
          }
        }}
        options={[
          ...PRESETS.map((p) => ({ value: p as number | 'custom', label: String(p) })),
          { value: 'custom', label: t.laCustom, ariaLabel: t.laCustomAria, compact: true },
        ]}
      />
      {custom && (
        <Field
          className="la-fld-gap"
          lead={t.laMinutes}
          trail={t.minShort}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={minutes || ''}
          onChange={(e) => setMinutes(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
        />
      )}
    </div>
  );

  const whenBlock = (
    <div className="la-blk">
      <p className="la-fl" id="ql-when">
        {t.laWhen}
      </p>
      <Segmented
        variant="buttons"
        tone={kt}
        labelledBy="ql-when"
        value={when}
        onChange={setWhen}
        options={[
          { value: 'now', label: t.laNow, disabled: props.locked },
          { value: 'earlier', label: t.laEarlierToday },
          { value: 'day', label: t.laPickDay, icon: 'calendar-blank' },
        ]}
      />
      {when === 'now' && <p className="la-note">{t.laEndsNow(range)}</p>}
      {when === 'day' && (
        <MonthCalendar
          value={day}
          now={now}
          tone={kt}
          activities={store.activities}
          onPick={setDay}
        />
      )}
      {when !== 'now' &&
        (web ? (
          <div className="la-grid2 la-gap-t">
            <Field
              id="ql-start"
              label={t.laStartTime}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value || '00:00')}
            />
            <div>
              <span className="la-fl">{t.laEnds}</span>
              <div className="la-fld plain ghost">
                {hhmm(finishedAt)} · {when === 'earlier' ? t.laTodayLower : dayLabel}
              </div>
            </div>
          </div>
        ) : (
          <div className="la-grid2 la-gap-t center">
            <Field
              lead={t.laStartLbl}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value || '00:00')}
            />
            <p className="la-when-sum">
              {when === 'earlier' ? t.today : dayLabel} · {time}
              <br />
              <span>
                {range} · {ago}
              </span>
            </p>
          </div>
        ))}
      {future && <p className="la-note warn">{t.laFuture}</p>}
    </div>
  );

  const distanceBlock = type.tracksDistance ? (
    web ? (
      <div className="la-blk la-grid2 end">
        <Field
          id="ql-dist"
          label={t.laDistanceKm}
          type="text"
          inputMode="decimal"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
        <div className="la-pacebox" aria-live="polite">
          <span>{t.laPace}</span>
          <b>{pace ? `${pace} /${t.laKm}` : '—'}</b>
        </div>
      </div>
    ) : (
      <div className="la-blk">
        <div className="la-row-sb">
          <label className="la-fl" htmlFor="ql-dist">
            {t.actDistance}
          </label>
          <p className="la-fl" aria-live="polite">
            {t.laPace} <span className="la-tc">{pace ? `${pace} /${t.laKm}` : '—'}</span>
          </p>
        </div>
        <Field
          id="ql-dist"
          type="text"
          inputMode="decimal"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          trail={
            <>
              <span className="la-unit la-unit-end">{t.laKm}</span>
              <IconButton
                size="sm"
                icon="minus"
                label={t.laDecDist}
                onClick={() => setDistance(fmtKm(Math.max(0, (km ?? 0) - 0.5)))}
              />
              <IconButton
                size="sm"
                icon="plus"
                label={t.laIncDist}
                onClick={() => setDistance(fmtKm((km ?? 0) + 0.5))}
              />
            </>
          }
        />
      </div>
    )
  ) : null;

  const effortBlock = (
    <div className="la-blk">
      <p className="la-fl" id="ql-eff">
        {t.actEffort}
      </p>
      <Segmented
        variant="buttons"
        tone={kt}
        labelledBy="ql-eff"
        value={effort}
        onChange={setEffort}
        options={EFFORTS.map((e) => ({ value: e, label: t.actEffortLevel[e] }))}
      />
    </div>
  );

  const metLine =
    met != null && bodyKg
      ? t.laMetLine(
          (Math.round(met * 10) / 10).toString(),
          String(Math.round(bodyKg)),
          (Math.round((minutes / 60) * 100) / 100).toString(),
        )
      : null;
  const estimate = (
    <div className="la-est" aria-live="polite">
      <div>
        <p className="la-est-l">{t.laEstimate}</p>
        {!web && <p className="la-est-s">{metLine ?? t.actNoWeight}</p>}
      </div>
      {kcal != null ? (
        <p>
          <span className="la-est-n">≈ {kcal}</span> <span className="la-est-u">{t.kcalShort}</span>
        </p>
      ) : (
        web && <p className="la-est-s">{t.actNoWeight}</p>
      )}
    </div>
  );

  const pinToggle = web ? (
    <PinToggle
      variant="row"
      tone={kt}
      pinned={pinned}
      onToggle={() => togglePin(type.key)}
      label={pinned ? t.laPinnedToTop : t.laPinToTop}
      text={pinned ? t.laPinnedToTop : t.laPinToTop}
      className="la-pin-web"
    />
  ) : (
    <label className="la-pinrow">
      <Icon name="push-pin" />
      <span id="ql-pin" className="la-pinrow-t">
        {pinned ? t.laPinned : t.laPin(typeName(type.key, t))}
        <span>{pinned ? t.laNameShowsFirst(typeName(type.key, t)) : t.laShowsFirst}</span>
      </span>
      <Switch
        checked={pinned}
        tone={kt}
        aria-labelledby="ql-pin"
        onChange={() => togglePin(type.key)}
      />
    </label>
  );

  const logLabel = t.laLogIt(when === 'now' || !web ? fmtDur(minutes, t) : range);
  const actions =
    web && when !== 'now' ? (
      <>
        <Button variant="primary" size="lg" fullWidth onClick={log} disabled={future || !minutes}>
          {t.laLogIt(range)}
        </Button>
        <p className="la-note center">{t.laPastNoTimer}</p>
      </>
    ) : (
      <>
        <div className="la-grid2 la-acts">
          <Button
            variant="secondary"
            size="lg"
            icon="play"
            disabled={props.locked || when !== 'now'}
            aria-describedby={when !== 'now' ? 'ql-tn' : undefined}
            onClick={start}
          >
            {t.laStartTimer}
          </Button>
          <Button variant="primary" size="lg" onClick={log} disabled={future || !minutes}>
            {logLabel}
          </Button>
        </div>
        {when !== 'now' && (
          <p id="ql-tn" className="la-note">
            {t.laTimerNowOnly}
          </p>
        )}
      </>
    );

  return (
    <div className={`la-ql ${web ? 'web' : 'mob'} ${tone}`}>
      <div className="la-ql-head">
        <span className="la-ico big">
          <Icon name={typeIcon(type.key)} />
        </span>
        <div className="la-ql-title">
          <div className="la-ql-name">
            <h2 id="ql-t">{title}</h2>
            <Tag
              tone={type.category === 'recovery' ? 'rest' : type.sport ? 'sport' : 'conditioning'}
            >
              {type.category === 'recovery' ? t.actCountsRecovery : t.actAddsConditioning}
            </Tag>
          </div>
          {lastLine && <p className="la-ql-last">{lastLine}</p>}
        </div>
        {/* The bottom sheet already carries its own ×; only the desktop panel needs one. */}
        {web && <IconButton icon="x" label={t.laCloseQuick} onClick={props.onClose} />}
      </div>
      {web && pinToggle}
      {durationBlock}
      {whenBlock}
      {distanceBlock}
      {effortBlock}
      {estimate}
      {web && metLine && <p className="la-est-s right">{metLine}</p>}
      {!web && pinToggle}
      {actions}
    </div>
  );
}

/** "Pick a day": the kit Calendar with activity markers by colour family,
 *  future days disabled, week start from settings. */
function MonthCalendar(props: {
  value: number;
  now: number;
  tone: Tone;
  activities: Activity[];
  onPick: (day: number) => void;
}) {
  const { t, locale } = useT();
  const days = useMemo(
    () => activityDays(props.activities, (a) => catTone(catOf(a.type))),
    [props.activities],
  );
  const today = dayOfTimestamp(props.now);
  const toneName: Record<string, string> = {
    'la-g': t.actConditioning.toLowerCase(),
    'la-s': t.actSports.toLowerCase(),
    'la-r': t.actRecovery.toLowerCase(),
  };
  const tonesOn = (day: number) => [...(days.get(timestampOfDay(day)) ?? [])].sort();
  const dayLabel = (day: number) => {
    const ts = timestampOfDay(day);
    const full = `${fmtWeekday(ts, locale)} ${fmtDayMonth(ts, locale)}`;
    const tones = tonesOn(day);
    if (day === today) return t.laDayToday(full);
    if (tones.length) return t.laDayHas(full, tones.map((x) => toneName[x]).join(` ${t.laAnd} `));
    return full;
  };
  return (
    <div className="la-cal">
      <Calendar
        mode="single"
        tone={props.tone}
        today={today}
        value={dayOfTimestamp(props.value)}
        max={today}
        label={t.laPickDayAria(fmtMonthYear(props.value, locale))}
        prevLabel={t.laPrevMonth}
        nextLabel={t.laNextMonth}
        dayLabel={dayLabel}
        markers={(day) => {
          const tones = tonesOn(day);
          return tones.length ? tones.map((x) => KIT_OF[x]) : undefined;
        }}
        onSelect={(day) => props.onPick(timestampOfDay(day))}
        footer={
          <CalendarLegend
            items={[
              { tone: 'conditioning', label: t.actConditioning },
              { tone: 'sport', label: t.actSports },
              { tone: 'rest', label: t.actRecovery },
            ]}
          />
        }
      />
    </div>
  );
}
