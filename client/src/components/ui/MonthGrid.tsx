/**
 * A month of day cells for browsing what happened (the History calendar):
 * each day is a tile with its number, small markers (sm) or named chips (lg),
 * a tinted fill for health states, a dashed outline for planned days, today
 * ringed and the selected day outlined. Weeks are full — the leading and
 * trailing days of the neighbouring months are shown dimmed.
 *
 * Not a picker: for choosing dates / ranges use <Calendar>. This one is
 * read-mostly — a tap selects a day and the caller shows its details.
 *
 * Accessibility: an ARIA grid of buttons with a roving tabindex on the
 * selected (or today's) day; arrows move the selection by day / week.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT, type LocaleId } from '../../i18n';
import { useWeekStartDay, weekOrder, type IsoDay } from '../../weekStart';
import { dayOfTimestamp, monthStart, monthWeeks, timestampOfDay, ymdOf } from './calendarDays';
import { toneClass, type Tone } from './tones';
import './MonthGrid.css';

/** Small markers under a day (sm size). */
export type MonthMarker = 'workout' | 'planned' | 'activity' | 'sleep' | 'weight' | 'pr';

export interface MonthGridChip {
  label: string;
  tone: Tone;
  /** Upcoming / not done yet: outlined instead of filled. */
  planned?: boolean;
}

export interface MonthGridDay {
  /** Health family that tints the whole cell (rest, illness, injury…). */
  tint?: Tone;
  /** Dashed outline: a planned training day or a planned rest day. */
  plan?: 'train' | 'rest';
  /** sm: markers in this order. */
  markers?: MonthMarker[];
  /** lg: named chips (sessions, activities). */
  chips?: MonthGridChip[];
  /** lg: plain lines under the chips ("Rest", "81.4 kg"). */
  notes?: { label: string; tone?: Tone }[];
  /** lg: top-right corner (e.g. hours slept). */
  meta?: ReactNode;
  /** lg: PR star next to the meta. */
  pr?: boolean;
  /** Accessible description appended to the date. */
  label?: string;
}

export interface MonthGridProps {
  /** Any day key in the month to show. */
  month: number;
  /** Returns what to draw on a day (undefined = empty). */
  day: (d: number) => MonthGridDay | undefined;
  selected?: number | null;
  onSelect?: (d: number) => void;
  /** sm = phone tiles with markers; lg = desktop tiles with chips. */
  size?: 'sm' | 'lg';
  /** Today's day key (default: the real today). */
  today?: number;
  /** First weekday (default: the account setting). */
  weekStart?: IsoDay;
  /** lg: the tag after today's number ("TODAY"). */
  todayLabel?: string;
  /** Accessible name of the grid. */
  label?: string;
  className?: string;
}

const INTL: Record<LocaleId, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};

/** Every day key of the month's full weeks (neighbour days included). */
export function monthGridDays(month: number, weekStart: IsoDay): number[] {
  const { y, m } = ymdOf(month);
  const weeks = monthWeeks(y, m, weekStart);
  const lead = weeks[0].findIndex((d) => d !== null);
  const first = monthStart(month) - lead;
  return Array.from({ length: weeks.length * 7 }, (_, i) => first + i);
}

/** One marker glyph — also used by filter chips and legends. */
export function MonthMarkerGlyph({ kind }: { kind: MonthMarker }) {
  if (kind === 'pr')
    return (
      <i className="uimg-mk uimg-mk--pr" aria-hidden="true">
        ★
      </i>
    );
  return <i className={`uimg-mk uimg-mk--${kind}`} aria-hidden="true" />;
}

export function MonthGrid({
  month,
  day,
  selected = null,
  onSelect,
  size = 'sm',
  today: todayProp,
  weekStart: weekStartProp,
  todayLabel,
  label,
  className,
}: MonthGridProps) {
  const { locale } = useT();
  const settingStart = useWeekStartDay();
  const weekStart = weekStartProp ?? settingStart;
  const [realToday] = useState(() => dayOfTimestamp(Date.now()));
  const today = todayProp ?? realToday;
  const cells = monthGridDays(month, weekStart);
  const { m: shownMonth } = ymdOf(month);
  const rootRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);
  const inGrid = (d: number | null) => d !== null && d >= cells[0] && d <= cells[cells.length - 1];
  const focusDay = inGrid(selected)
    ? (selected as number)
    : inGrid(today)
      ? today
      : monthStart(month);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  });

  const heads = weekOrder(weekStart).map((iso) => {
    const d = new Date(2026, 0, 4 + iso);
    const long = new Intl.DateTimeFormat(INTL[locale], { weekday: 'long' }).format(d);
    const short = new Intl.DateTimeFormat(INTL[locale], {
      weekday: size === 'lg' ? 'short' : 'narrow',
    })
      .format(d)
      .replace('.', '')
      .toUpperCase();
    return { long, short };
  });
  const fmtFull = new Intl.DateTimeFormat(INTL[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const fmtShortMonth = new Intl.DateTimeFormat(INTL[locale], { month: 'short' });

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: number) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = step[e.key];
    if (delta === undefined || !onSelect) return;
    e.preventDefault();
    wantFocus.current = true;
    onSelect(d + delta);
  };

  const rows: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div
      ref={rootRef}
      className={['uimg', `uimg--${size}`, className].filter(Boolean).join(' ')}
      role="grid"
      aria-label={label}
    >
      <div className="uimg-row uimg-heads" role="row">
        {heads.map((h) => (
          <span key={h.long} className="uimg-wd" role="columnheader" aria-label={h.long}>
            <span aria-hidden="true">{h.short}</span>
          </span>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div className="uimg-row" role="row" key={ri}>
          {row.map((d, ci) => {
            const info = day(d);
            const { m, d: num } = ymdOf(d);
            const out = m !== shownMonth;
            const isToday = d === today;
            const isSel = d === selected;
            const future = d > today;
            const cls = [
              'uimg-day',
              info?.tint ? `is-tint ${toneClass(info.tint)}` : '',
              info?.plan ? `is-plan-${info.plan}` : '',
              future && !info?.plan && !info?.tint ? 'is-future' : '',
              out ? 'is-out' : '',
              isToday ? 'is-today' : '',
              isSel ? 'is-sel' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const prefix = size === 'lg' && out && ri === 0 && ci === 0;
            const numText = prefix
              ? `${fmtShortMonth.format(new Date(timestampOfDay(d)))} ${num}`
              : String(num);
            const aria = [fmtFull.format(new Date(timestampOfDay(d))), info?.label]
              .filter(Boolean)
              .join(', ');
            return (
              <div key={d} role="gridcell" aria-selected={isSel} className="uimg-cell">
                <button
                  type="button"
                  className={cls}
                  data-day={d}
                  tabIndex={d === focusDay ? 0 : -1}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={aria}
                  onClick={() => onSelect?.(d)}
                  onKeyDown={(e) => onKey(e, d)}
                >
                  <span className="uimg-top">
                    <span className="uimg-num">{numText}</span>
                    {size === 'lg' && isToday && todayLabel && (
                      <span className="uimg-todaytag">{todayLabel}</span>
                    )}
                    {size === 'lg' && (info?.meta != null || info?.pr) && (
                      <span className="uimg-meta">
                        {info?.meta}
                        {info?.pr && <MonthMarkerGlyph kind="pr" />}
                      </span>
                    )}
                  </span>
                  {size === 'sm' && (
                    <span className="uimg-marks">
                      {(info?.markers ?? []).map((k, i) => (
                        <MonthMarkerGlyph key={k + i} kind={k} />
                      ))}
                    </span>
                  )}
                  {size === 'lg' &&
                    info?.chips?.map((c, i) => (
                      <span
                        key={c.label + i}
                        className={`uimg-chip ${toneClass(c.tone)}${c.planned ? ' is-planned' : ''}`}
                      >
                        {c.label}
                      </span>
                    ))}
                  {size === 'lg' &&
                    info?.notes?.map((n, i) => (
                      <span
                        key={n.label + i}
                        className={`uimg-note${n.tone ? ` is-toned ${toneClass(n.tone)}` : ''}`}
                      >
                        {n.label}
                      </span>
                    ))}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export type MonthLegendItem =
  | { kind: MonthMarker; label: string }
  | { kind: 'tint'; tone: Tone; label: string }
  | { kind: 'plan'; label: string };

/** Legend for a MonthGrid: marker glyphs, tint swatches, the planned outline. */
export function MonthGridLegend({ items }: { items: MonthLegendItem[] }) {
  return (
    <div className="uimg-legend" aria-hidden="true">
      {items.map((it) => (
        <span key={it.kind + it.label}>
          {it.kind === 'tint' ? (
            <i className={`uimg-sw ${toneClass(it.tone)}`} />
          ) : it.kind === 'plan' ? (
            <i className="uimg-sw is-plan" />
          ) : (
            <MonthMarkerGlyph kind={it.kind} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
