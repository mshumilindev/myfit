/**
 * The one calendar of the app (Health date ranges, Log activity "Pick a day",
 * anything that picks days). Single-date or range selection, week start from
 * the account setting, min / max / disabled days, coloured markers, a today
 * ring, one or two months side by side (two collapse to one when the
 * container is narrower than 480px), a presets slot above and a footer slot
 * (legend) below.
 *
 * Accessibility: each month is an ARIA grid (rows / columnheaders /
 * gridcells with aria-selected) of real buttons with a roving tabindex —
 * arrows move by day / week, Home / End to the week's ends, PageUp / PageDown
 * by month (crossing months pages the view), Enter / Space picks. Disabled
 * days stay visible and are skipped by the keyboard.
 *
 * Days are integer day keys (calendarDays.ts). Colours come from one Tone.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useT, type LocaleId } from '../../i18n';
import { Icon } from '../../ui';
import { useWeekStartDay, weekOrder, type IsoDay } from '../../weekStart';
import {
  addMonths,
  columnOf,
  dayOfTimestamp,
  monthEnd,
  monthStart,
  monthWeeks,
  timestampOfDay,
  ymdOf,
} from './calendarDays';
import { toneClass, type Tone } from './tones';
import './Calendar.css';

export interface CalendarRange {
  start: number;
  end: number;
  /** Ongoing: the range runs to `end` (usually today) with a dashed open end. */
  open?: boolean;
}

export interface CalendarProps {
  mode?: 'single' | 'range';
  /** Single mode: the selected day. */
  value?: number | null;
  /** Range mode: the selected range (start === end for one day). */
  range?: CalendarRange | null;
  onSelect: (day: number) => void;
  /** Colour family of the selection. */
  tone?: Tone;
  /** Today's day key (default: the real today). */
  today?: number;
  /** First weekday (default: the account setting). */
  weekStart?: IsoDay;
  min?: number;
  max?: number;
  isDisabled?: (day: number) => boolean;
  /** Up to three coloured dots under a day. */
  markers?: (day: number) => readonly Tone[] | undefined;
  /** Days inside the range that the range skips (drawn unfilled). */
  isSkipped?: (day: number) => boolean;
  /** One month, or two side by side (collapses to one when narrow). */
  months?: 1 | 2;
  /** A day in the month to open on (default: the selection, else today). */
  initialDay?: number;
  /** Accessible label of a day button (default: localized full date). */
  dayLabel?: (day: number) => string;
  prevLabel?: string;
  nextLabel?: string;
  /** Accessible name of the whole calendar. */
  label?: string;
  /** Slot above the months — usually <PresetChips>. */
  presets?: ReactNode;
  /** Slot below the months — e.g. a marker legend. */
  footer?: ReactNode;
  className?: string;
}

const INTL: Record<LocaleId, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};
const NARROW_PX = 480;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtCalendarMonth(day: number, locale: LocaleId): string {
  return cap(
    new Intl.DateTimeFormat(INTL[locale], { month: 'long', year: 'numeric' }).format(
      new Date(timestampOfDay(day)),
    ),
  );
}

function fmtFull(day: number, locale: LocaleId): string {
  return new Intl.DateTimeFormat(INTL[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(timestampOfDay(day)));
}

/** Weekday heads in week order: [narrow, long]. 5 Jan 2026 is a Monday. */
function weekdayHeads(start: IsoDay, locale: LocaleId): [string, string][] {
  const n = new Intl.DateTimeFormat(INTL[locale], { weekday: 'narrow' });
  const l = new Intl.DateTimeFormat(INTL[locale], { weekday: 'long' });
  return weekOrder(start).map((iso) => {
    const d = new Date(2026, 0, 4 + iso);
    return [n.format(d).toUpperCase(), l.format(d)];
  });
}

let uid = 0;

export function Calendar(props: CalendarProps) {
  const { t, locale } = useT();
  const settingStart = useWeekStartDay();
  const weekStart = props.weekStart ?? settingStart;
  const [realToday] = useState(() => dayOfTimestamp(Date.now()));
  const today = props.today ?? realToday;
  const tone = props.tone ?? 'accent';
  const mode = props.mode ?? (props.range ? 'range' : 'single');
  const [id] = useState(() => `uical${++uid}`);

  // --- selection model ------------------------------------------------------------
  const r = mode === 'range' ? props.range : null;
  const selStart = r ? r.start : (props.value ?? null);
  const selEnd = r ? (r.open ? Math.max(r.end, r.start) : r.end) : (props.value ?? null);
  const open = !!r?.open;
  const inSel = (d: number) => selStart !== null && selEnd !== null && d >= selStart && d <= selEnd;
  const skipped = (d: number) => inSel(d) && !!props.isSkipped?.(d);
  const inBand = (d: number) => inSel(d) && !skipped(d);
  const disabled = (d: number) =>
    (props.min !== undefined && d < props.min) ||
    (props.max !== undefined && d > props.max) ||
    !!props.isDisabled?.(d);

  // --- visible months ---------------------------------------------------------------
  const wanted = props.months ?? 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (wanted !== 2 || !el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setNarrow(el.clientWidth > 0 && el.clientWidth < NARROW_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wanted]);
  const count = wanted === 2 && !narrow ? 2 : 1;
  const focusOrigin =
    props.initialDay ?? (r && !r.open ? r.end : (selStart ?? props.value ?? today));
  const [last, setLast] = useState(() => monthStart(focusOrigin));
  const first = addMonths(last, -(count - 1));
  const visibleStart = first;
  const visibleEnd = monthEnd(last);

  // The view follows a selection that lands outside it (a preset, an edit).
  const [seen, setSeen] = useState<[number | null, number | null]>([selStart, selEnd]);
  if (seen[0] !== selStart || seen[1] !== selEnd) {
    setSeen([selStart, selEnd]);
    const moved = seen[1] !== selEnd && !open ? selEnd : selStart;
    if (moved !== null && (moved < first || moved > monthEnd(last))) setLast(monthStart(moved));
  }

  const prevBlocked = props.min !== undefined && first <= props.min;
  const nextBlocked = props.max !== undefined && addMonths(last, 1) > props.max;

  // --- roving focus -----------------------------------------------------------------
  const pickFocus = (): number => {
    const cands = [selStart, today, first].filter(
      (d): d is number => d !== null && d >= visibleStart && d <= visibleEnd,
    );
    for (const c of cands) if (!disabled(c)) return c;
    for (let d = visibleStart; d <= visibleEnd; d++) if (!disabled(d)) return d;
    return cands[0] ?? first;
  };
  const [active, setActive] = useState<number | null>(null);
  const focusDay =
    active !== null && active >= visibleStart && active <= visibleEnd ? active : pickFocus();
  const wantFocus = useRef(false);
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  });

  const moveTo = (target: number, dir: 1 | -1) => {
    let d = target;
    for (let i = 0; i < 400 && disabled(d); i++) {
      d += dir;
      if ((props.max !== undefined && d > props.max) || (props.min !== undefined && d < props.min))
        return;
    }
    if (disabled(d)) return;
    if (d > visibleEnd) setLast(monthStart(d));
    else if (d < visibleStart) setLast(addMonths(monthStart(d), count - 1));
    setActive(d);
    wantFocus.current = true;
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: number) => {
    const col = columnOf(d, weekStart);
    const dd = ymdOf(d).d;
    let target: number;
    let dir: 1 | -1 = 1;
    switch (e.key) {
      case 'ArrowRight':
        target = d + 1;
        break;
      case 'ArrowLeft':
        target = d - 1;
        dir = -1;
        break;
      case 'ArrowDown':
        target = d + 7;
        break;
      case 'ArrowUp':
        target = d - 7;
        dir = -1;
        break;
      case 'Home':
        target = d - col;
        break;
      case 'End':
        target = d + (6 - col);
        dir = -1;
        break;
      case 'PageDown': {
        const n = addMonths(d, 1);
        target = Math.min(n + dd - 1, monthEnd(n));
        break;
      }
      case 'PageUp': {
        const p = addMonths(monthStart(d), -1);
        target = Math.min(p + dd - 1, monthEnd(p));
        dir = -1;
        break;
      }
      default:
        return;
    }
    e.preventDefault();
    moveTo(target, dir);
  };

  // --- rendering --------------------------------------------------------------------
  const heads = weekdayHeads(weekStart, locale);
  const prevLabel = props.prevLabel ?? t.hlPrevMonth;
  const nextLabel = props.nextLabel ?? t.hlNextMonth;
  const shift = (delta: number) => {
    setLast((l) => addMonths(l, delta));
    setActive(null);
  };

  const navBtn = (kind: 'prev' | 'next') => (
    <button
      type="button"
      className="uical-nav"
      aria-label={kind === 'prev' ? prevLabel : nextLabel}
      disabled={kind === 'prev' ? prevBlocked : nextBlocked}
      onClick={() => shift(kind === 'prev' ? -1 : 1)}
    >
      <Icon name={kind === 'prev' ? 'caret-left' : 'caret-right'} />
    </button>
  );

  const renderMonth = (mStart: number, idx: number) => {
    const { y, m } = ymdOf(mStart);
    const weeks = monthWeeks(y, m, weekStart);
    const titleId = `${id}-m${idx}`;
    const isFirst = idx === 0;
    const isLast = idx === count - 1;
    const mEnd = monthEnd(mStart);
    return (
      <div className="uical-month" key={mStart}>
        <div className="uical-head">
          {isFirst ? navBtn('prev') : <span className="uical-navsp" />}
          <h3 className="uical-title" id={titleId} aria-live="polite">
            {fmtCalendarMonth(mStart, locale)}
          </h3>
          {isLast ? navBtn('next') : <span className="uical-navsp" />}
        </div>
        <div className="uical-grid" role="grid" aria-labelledby={titleId}>
          <div className="uical-row uical-heads" role="row">
            {heads.map(([n, l]) => (
              <span key={l} className="uical-dw" role="columnheader" aria-label={l}>
                <span aria-hidden="true">{n}</span>
              </span>
            ))}
          </div>
          {weeks.map((row, ri) => (
            <div className="uical-row" role="row" key={ri}>
              {row.map((d, ci) => {
                if (d === null)
                  return <span key={`e${ci}`} className="uical-cell" role="gridcell" />;
                const band = inBand(d);
                const isStart = band && d === selStart;
                const isEnd = band && d === selEnd;
                const solid = (isStart || isEnd) && !(open && isEnd && !isStart);
                const openEnd = open && isEnd && !isStart;
                const prevIn = band && !isStart && d > mStart && ci > 0 && inBand(d - 1);
                const nextIn = band && !isEnd && d < mEnd && ci < 6 && inBand(d + 1);
                const dis = disabled(d);
                const marks = props.markers?.(d)?.slice(0, 3) ?? [];
                const cls = [
                  'uical-cell',
                  band ? 'is-band' : '',
                  prevIn ? 'band-l' : '',
                  nextIn ? 'band-r' : '',
                  solid ? 'is-solid' : '',
                  openEnd ? 'is-open' : '',
                  d === today ? 'is-today' : '',
                  dis ? 'is-disabled' : '',
                  skipped(d) ? 'is-skipped' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div key={d} className={cls} role="gridcell" aria-selected={band}>
                    <button
                      type="button"
                      className="uical-day"
                      data-day={d}
                      tabIndex={d === focusDay ? 0 : -1}
                      disabled={dis}
                      aria-current={d === today ? 'date' : undefined}
                      aria-label={props.dayLabel ? props.dayLabel(d) : fmtFull(d, locale)}
                      onClick={() => {
                        setActive(d);
                        props.onSelect(d);
                      }}
                      onKeyDown={(e) => onKey(e, d)}
                    >
                      <span className="uical-num">{ymdOf(d).d}</span>
                      {marks.length > 0 && (
                        <span className="uical-dots" aria-hidden="true">
                          {marks.map((mk, i) => (
                            <i key={i} className={toneClass(mk)} />
                          ))}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const monthsList = Array.from({ length: count }, (_, i) => addMonths(first, i));
  return (
    <div
      ref={rootRef}
      className={['uical', toneClass(tone), count === 2 ? 'is-double' : '', props.className]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={props.label}
    >
      {props.presets != null && <div className="uical-presets">{props.presets}</div>}
      <div className="uical-months">{monthsList.map(renderMonth)}</div>
      {props.footer != null && <div className="uical-footer">{props.footer}</div>}
    </div>
  );
}

/** A legend row for calendar markers: dot + label per family. */
export function CalendarLegend({ items }: { items: { tone: Tone; label: string }[] }) {
  return (
    <div className="uical-legend" aria-hidden="true">
      {items.map((it) => (
        <span key={it.tone + it.label} className={toneClass(it.tone)}>
          <i />
          {it.label}
        </span>
      ))}
    </div>
  );
}
