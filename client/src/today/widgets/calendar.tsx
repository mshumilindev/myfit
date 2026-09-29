/**
 * Calendar widgets (design board K1 "Calendar widget"): the month at a glance
 * and the year in pixels. Both read the real logs — finished workouts,
 * activities, nights, rest / illness / off periods and injuries — through one
 * cached per-day map, so every size stays cheap to render.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Widget } from '../../components/ui/Widget';
import { Button, IconButton } from '../../components/ui/Button';
import { toneClass, type Tone } from '../../components/ui/tones';
import {
  addMonths,
  dayKeyOf,
  dayOfTimestamp,
  monthEnd,
  monthStart,
  monthWeeks,
  timestampOfDay,
  ymdOf,
} from '../../components/ui/calendarDays';
import { fmtCalendarMonth } from '../../components/ui/Calendar';
import { prescribedTrainingDays } from '../../store';
import { isoWeekday, weekOrder, weekStartDay, type IsoDay } from '../../weekStart';
import { getLocale, type LocaleId } from '../../i18n';
import { countRange, dayMap, type DayInfo, type DayMap, type HealthKind } from '../calendarData';
import type { WidgetCtx, WidgetDef } from '../registry';
import { cs, type CalendarStrings } from './calendar.strings';

/* ---------------------------------------------------------------------------
 * Presentation helpers (tokens only; layout inline).
 * ------------------------------------------------------------------------- */

const HEALTH_TONE: Record<HealthKind, Tone> = {
  rest: 'rest',
  sick: 'illness',
  off: 'neutral',
  injury: 'injury',
};

function healthLabel(k: HealthKind, s: CalendarStrings): string {
  return k === 'rest' ? s.rest : k === 'sick' ? s.sick : k === 'off' ? s.off : s.injury;
}

/** Narrow weekday letters in the account's week order. */
function weekLetters(locale: LocaleId, start: IsoDay): string[] {
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, { weekday: 'narrow' });
  return weekOrder(start).map((iso) => fmt.format(new Date(2026, 0, 4 + iso)).toUpperCase());
}

const dotBase: CSSProperties = {
  display: 'block',
  width: 4,
  height: 4,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--t-base)',
};

/** The marks under a day number: brass dash (workout), dots, PR star. */
function Marks({ info, compact }: { info: DayInfo | undefined; compact?: boolean }) {
  if (!info) return <span style={{ height: 5 }} />;
  const hasW = info.workouts.length > 0;
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center', height: 5 }}>
      {hasW && (
        <span
          className={toneClass('accent')}
          style={{ ...dotBase, width: compact ? 7 : 9, height: 3 }}
        />
      )}
      {info.activity && <span className={toneClass('sport')} style={dotBase} />}
      {info.sleep && !compact && <span className={toneClass('sleep')} style={dotBase} />}
    </span>
  );
}

interface CellOpts {
  info: DayInfo | undefined;
  day: number;
  today: number;
  planned: boolean;
  dim?: boolean;
}

function cellStyle({ info, day, today, planned }: CellOpts): CSSProperties {
  const future = day > today;
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    border: 0,
    borderRadius: 'var(--radius-md)',
    background: info?.health ? 'var(--t-tint)' : 'transparent',
    outline:
      day === today
        ? '1.5px solid var(--color-accent)'
        : future && planned
          ? '1px dashed var(--color-border)'
          : undefined,
    outlineOffset: -1.5,
    color: future ? 'var(--color-text-faint)' : 'var(--color-text)',
    font: 'inherit',
    fontSize: 11.5,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    position: 'relative',
  };
}

function CellBody({ info, day, star }: { info: DayInfo | undefined; day: number; star: boolean }) {
  return (
    <>
      <span>
        {ymdOf(day).d}
        {star && info?.pr && (
          <span
            className={toneClass('accent')}
            style={{ color: 'var(--t-base)', fontSize: 8, marginLeft: 1, verticalAlign: 'top' }}
          >
            ★
          </span>
        )}
      </span>
      <Marks info={info} />
    </>
  );
}

function DayCell(props: CellOpts & { onPick?: (day: number) => void; label?: string }) {
  const { info, day, onPick } = props;
  const cls = info?.health ? toneClass(HEALTH_TONE[info.health]) : undefined;
  if (onPick)
    return (
      <button
        type="button"
        className={cls}
        style={{ ...cellStyle(props), cursor: 'pointer' }}
        onClick={() => onPick(day)}
        aria-label={props.label}
      >
        <CellBody info={info} day={day} star />
      </button>
    );
  return (
    <span className={cls} style={cellStyle(props)}>
      <CellBody info={info} day={day} star />
    </span>
  );
}

function Legend({ items }: { items: { tone: Tone; label: string; dash?: boolean }[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 10px',
        fontSize: 10.5,
        color: 'var(--color-text-muted)',
      }}
    >
      {items.map((it) => (
        <span
          key={it.label}
          className={toneClass(it.tone)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ ...dotBase, width: it.dash ? 9 : 6, height: it.dash ? 3 : 6 }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

const grid7: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 3,
};

function HeadRow({ letters }: { letters: string[] }) {
  return (
    <div style={{ ...grid7, fontSize: 10, color: 'var(--color-text-faint)', textAlign: 'center' }}>
      {letters.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

function openDay(ctx: WidgetCtx, info: DayInfo | undefined) {
  const w = info?.workouts;
  if (w && w.length === 1) ctx.shell.openOverlay({ screen: 'past-workout', workoutId: w[0].id });
  else ctx.shell.openOverlay({ screen: 'history' });
}

/* ---------------------------------------------------------------------------
 * Calendar
 * ------------------------------------------------------------------------- */

function MonthCalendar({ ctx }: { ctx: WidgetCtx }) {
  const { store, now, locale } = ctx;
  const s = cs(locale);
  const today = dayOfTimestamp(now);
  const [offset, setOffset] = useState(0);
  const start = weekStartDay();
  const mStart = addMonths(today, offset);
  const { y, m } = ymdOf(mStart);
  const weeks = monthWeeks(y, m, start);
  const map = dayMap(store, now);
  const planned = prescribedTrainingDays();
  const isPlanned = (d: number) => d > today && planned.has(isoWeekday(timestampOfDay(d)));
  const shown = mStart;
  const sum = countRange(map, monthStart(shown), Math.min(monthEnd(shown), today));
  const shortMonth = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, {
    month: 'short',
  }).format(new Date(timestampOfDay(shown)));
  const open = () => ctx.shell.openOverlay({ screen: 'history' });
  return (
    <Widget
      size="XL"
      tone="accent"
      kicker={s.calendar}
      onClick={open}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.monthSummary(shortMonth, sum.trained, (sum.volumeKg / 1000).toFixed(1))}
          </span>
          <Button variant="primary" size="sm" onClick={open}>
            {s.openCalendar}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>
          {fmtCalendarMonth(mStart, locale)}
        </span>
        <IconButton
          size="sm"
          icon="caret-left"
          label={ctx.t.hlPrevMonth}
          onClick={() => setOffset((o) => o - 1)}
        />
        <IconButton
          size="sm"
          icon="caret-right"
          label={ctx.t.hlNextMonth}
          disabled={offset >= 1}
          onClick={() => setOffset((o) => o + 1)}
        />
      </div>
      <HeadRow letters={weekLetters(locale, start)} />
      <div
        style={{
          ...grid7,
          flex: 1,
          minHeight: 0,
          gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
        }}
      >
        {weeks
          .flat()
          .map((d, i) =>
            d === null ? (
              <span key={`e${i}`} />
            ) : (
              <DayCell
                key={d}
                day={d}
                today={today}
                info={map.get(d)}
                planned={isPlanned(d)}
                onPick={(day) => openDay(ctx, map.get(day))}
              />
            ),
          )}
      </div>
      <Legend
        items={[
          { tone: 'accent', label: s.workout, dash: true },
          { tone: 'sport', label: s.activity },
          { tone: 'sleep', label: s.sleep },
          { tone: 'rest', label: s.rest },
          { tone: 'illness', label: s.sick },
          { tone: 'injury', label: s.injury },
        ]}
      />
    </Widget>
  );
}

const calendar: WidgetDef = {
  id: 'calendar',
  group: 'calendar',
  icon: 'calendar-blank',
  tone: 'accent',
  name: () => cs(getLocale()).calendar,
  render: (size, ctx) => {
    if (size === 'XL') return <MonthCalendar ctx={ctx} />;
    const { store, now, locale, shell } = ctx;
    const s = cs(locale);
    const today = dayOfTimestamp(now);
    const map = dayMap(store, now);
    const open = () => shell.openOverlay({ screen: 'history' });
    const start = weekStartDay();
    const letters = weekLetters(locale, start);
    const planned = prescribedTrainingDays();
    const isPlanned = (d: number) => d > today && planned.has(isoWeekday(timestampOfDay(d)));

    if (size === 'S') {
      const r = countRange(map, today - 29, today);
      const parts = [
        r.health.rest + r.health.off ? s.restN(r.health.rest + r.health.off) : null,
        r.health.sick ? s.sickN(r.health.sick) : null,
        r.prDays ? s.prsN(r.prDays) : null,
      ].filter(Boolean);
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.last30}
          value={r.logged ? r.trained : '—'}
          unit={r.logged ? s.daysTrained : undefined}
          sub={r.logged ? parts.join(' · ') || s.loggedN(r.logged) : s.fillHint}
          onClick={open}
        />
      );
    }

    // Week in the account's order, containing today.
    const pos = (isoWeekday(now) - start + 7) % 7;
    const weekDays = Array.from({ length: 7 }, (_, i) => today - pos + i);

    if (size === 'M') {
      const trainedWeek = weekDays.filter((d) => (map.get(d)?.workouts.length ?? 0) > 0).length;
      return (
        <Widget
          size="M"
          tone="accent"
          icon="calendar-blank"
          title={
            <div style={{ ...grid7, gap: 2, maxWidth: 240 }}>
              {weekDays.map((d, i) => (
                <DayCell
                  key={d}
                  day={d}
                  today={today}
                  info={map.get(d)}
                  planned={isPlanned(d)}
                  label={letters[i]}
                />
              ))}
            </div>
          }
          sub={s.thisWeekTrained(trainedWeek)}
          onClick={open}
        />
      );
    }

    // L: the last two weeks (this week and the one before).
    const days = [...weekDays.map((d) => d - 7), ...weekDays];
    const r = countRange(map, days[0], today);
    const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, {
      month: 'short',
      day: 'numeric',
    });
    const span = `${fmt.format(new Date(timestampOfDay(days[0])))} – ${fmt.format(
      new Date(timestampOfDay(days[13])),
    )}`;
    return (
      <Widget
        size="L"
        tone="accent"
        kicker={span}
        badge={r.logged ? `${s.loggedN(r.logged)} · ${s.prsN(r.prDays)}` : s.nothingYet}
        onClick={open}
      >
        <HeadRow letters={letters} />
        <div style={{ ...grid7, flex: 1, gridTemplateRows: 'repeat(2, minmax(0, 1fr))' }}>
          {days.map((d) => (
            <DayCell key={d} day={d} today={today} info={map.get(d)} planned={isPlanned(d)} />
          ))}
        </div>
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Year in pixels
 * ------------------------------------------------------------------------- */

type PixelKind = 'trained' | 'activity' | HealthKind | 'none' | 'future';

const PIXEL_COLOR: Record<PixelKind, string> = {
  trained: 'var(--color-accent)',
  activity: 'var(--color-sport)',
  rest: 'var(--color-rest)',
  sick: 'var(--color-illness)',
  off: 'var(--color-neutral-600)',
  injury: 'var(--color-injury)',
  none: 'var(--color-neutral-800)',
  future: 'var(--color-tile)',
};

function pixelKind(info: DayInfo | undefined, day: number, today: number): PixelKind {
  if (day > today) return info?.health ?? 'future';
  if (!info) return 'none';
  if (info.workouts.length > 0) return 'trained';
  if (info.health) return info.health;
  if (info.activity) return 'activity';
  return 'none';
}

interface YearStats {
  year: number;
  first: number;
  last: number;
  elapsed: number;
  logged: number;
  counts: Record<PixelKind, number>;
  longest: number;
}

function yearStats(map: DayMap, today: number): YearStats {
  const year = ymdOf(today).y;
  const first = dayKeyOf(year, 0, 1);
  const last = dayKeyOf(year, 11, 31);
  const counts: Record<PixelKind, number> = {
    trained: 0,
    activity: 0,
    rest: 0,
    sick: 0,
    off: 0,
    injury: 0,
    none: 0,
    future: 0,
  };
  let logged = 0;
  let run = 0;
  let longest = 0;
  for (let d = first; d <= today; d++) {
    const info = map.get(d);
    const k = pixelKind(info, d, today);
    const any = !!info && (k !== 'none' || info.sleep);
    counts[k]++;
    if (any) {
      logged++;
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return { year, first, last, elapsed: today - first + 1, logged, counts, longest };
}

/** Days as square pixels, one column per week (week order from the setting). */
function PixelGrid({
  map,
  from,
  to,
  today,
  monthLabels,
  locale,
}: {
  map: DayMap;
  from: number;
  to: number;
  today: number;
  monthLabels?: boolean;
  locale: LocaleId;
}) {
  const start = weekStartDay();
  const lead = (isoWeekday(timestampOfDay(from)) - start + 7) % 7;
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = from; d <= to; d++) cells.push(d);
  const cols = Math.ceil(cells.length / 7);
  const labels: { col: number; text: string }[] = [];
  if (monthLabels) {
    const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, { month: 'short' });
    for (let mo = 0; mo < 12; mo += 2) {
      const d = dayKeyOf(ymdOf(from).y, mo, 1);
      if (d < from || d > to) continue;
      labels.push({ col: Math.floor((d - from + lead) / 7), text: fmt.format(timestampOfDay(d)) });
    }
  }
  const tmpl = `repeat(${cols}, minmax(0, 1fr))`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: tmpl,
          gridTemplateRows: 'repeat(7, auto)',
          gridAutoFlow: 'column',
          gap: 1.5,
        }}
        aria-hidden="true"
      >
        {cells.map((d, i) =>
          d === null ? (
            <span key={`e${i}`} />
          ) : (
            <span
              key={d}
              style={{
                aspectRatio: '1 / 1',
                background: PIXEL_COLOR[pixelKind(map.get(d), d, today)],
                outline: d === today ? '1px solid var(--color-text)' : undefined,
              }}
            />
          ),
        )}
      </div>
      {labels.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: tmpl,
            fontSize: 9.5,
            color: 'var(--color-text-faint)',
          }}
        >
          {labels.map((l) => (
            <span key={l.col} style={{ gridColumn: `${l.col + 1} / span 6`, whiteSpace: 'nowrap' }}>
              {l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function breakdown(
  st: YearStats,
  s: CalendarStrings,
): { kind: PixelKind; label: string; n: number }[] {
  return [
    { kind: 'trained' as const, label: s.trained, n: st.counts.trained },
    { kind: 'activity' as const, label: s.activityOnly, n: st.counts.activity },
    { kind: 'rest' as const, label: s.rest, n: st.counts.rest },
    { kind: 'sick' as const, label: s.sick, n: st.counts.sick },
    { kind: 'off' as const, label: s.off, n: st.counts.off },
    { kind: 'injury' as const, label: s.injury, n: st.counts.injury },
  ];
}

function Swatch({ kind }: { kind: PixelKind }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        flex: 'none',
        borderRadius: 'var(--radius-sm)',
        background: PIXEL_COLOR[kind],
      }}
    />
  );
}

const yearPixels: WidgetDef = {
  id: 'year-pixels',
  group: 'calendar',
  icon: 'squares-four',
  tone: 'accent',
  name: () => cs(getLocale()).yearPixels,
  render: (size, { store, now, locale, shell }) => {
    const s = cs(locale);
    const today = dayOfTimestamp(now);
    const map = dayMap(store, now);
    const st = yearStats(map, today);
    const open = () => shell.openOverlay({ screen: 'history' });
    const restSick = [
      st.counts.rest ? s.restN(st.counts.rest) : null,
      st.counts.sick ? s.sickN(st.counts.sick) : null,
    ].filter(Boolean);
    const sub: ReactNode = st.logged
      ? [s.trainedN(st.counts.trained), ...restSick].join(' · ')
      : s.fillHint;

    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="squares-four"
          title={st.logged ? s.daysLoggedYear(st.logged, st.year) : s.inPixels(st.year)}
          sub={sub}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.inPixels(st.year)}
          value={st.logged}
          unit={s.days}
          sub={st.logged ? s.loggedTrained(st.counts.trained) : s.nothingYet}
          onClick={open}
        >
          <PixelGrid map={map} from={today - 7 * 12} to={today} today={today} locale={locale} />
        </Widget>
      );
    const grid = (
      <PixelGrid map={map} from={st.first} to={st.last} today={today} monthLabels locale={locale} />
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.everyDay(st.year)}
          badge={s.loggedOf(st.logged, st.elapsed)}
          onClick={open}
        >
          {grid}
          <div
            style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--color-text-muted)' }}
          >
            {breakdown(st, s)
              .filter((b) => b.kind !== 'off')
              .map((b) => (
                <span
                  key={b.kind}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Swatch kind={b.kind} />
                  {b.label}
                </span>
              ))}
          </div>
        </Widget>
      );
    const pctLogged = st.elapsed ? Math.round((st.logged / st.elapsed) * 100) : 0;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.pixelsTitle(st.year)}
        badge={st.longest ? s.longestStreak(st.longest) : undefined}
        value={st.logged}
        unit={s.days}
        sub={st.logged ? s.loggedPct(pctLogged) : s.fillHint}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.openCalendar}
          </Button>
        }
      >
        {grid}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '6px 16px',
            fontSize: 12.5,
          }}
        >
          {breakdown(st, s).map((b) => (
            <span
              key={b.kind}
              style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
            >
              <Swatch kind={b.kind} />
              <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-muted)' }}>
                {b.label}
              </span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{b.n}</span>
            </span>
          ))}
        </div>
      </Widget>
    );
  },
};

/** Label helper kept for other groups that show a day's health state. */
export function healthKindLabel(k: HealthKind, locale: LocaleId): string {
  return healthLabel(k, cs(locale));
}

export const CALENDAR_WIDGETS: WidgetDef[] = [calendar, yearPixels];
