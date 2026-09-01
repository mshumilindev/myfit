/**
 * Date / time / duration pickers for the backfill sheet (and anywhere a past
 * value is entered). Each field keeps MANUAL text entry as the source of truth
 * and layers a Nocturne-styled visual picker on top — no native browser widget
 * (those ignore the graphite/brass tokens) and no third-party lib (offline PWA,
 * pixel-parity with the boards). Design: docs/DESIGN.md.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { Icon } from '../ui';

/* --- shared popover shell ------------------------------------------------- */

function Popover({
  open,
  onClose,
  children,
  className,
  anchorRef,
  placement = 'down',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: 'up' | 'down';
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const style = useAnchoredPopoverStyle(open, ref, anchorRef, placement);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`picker-pop${className ? ` ${className}` : ''}`}
      ref={ref}
      role="dialog"
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function useAnchoredPopoverStyle(
  open: boolean,
  popoverRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  placement: 'up' | 'down',
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor || !document.body.contains(anchor)) return;
      const rect = anchor.getBoundingClientRect();
      const pop = popoverRef.current?.getBoundingClientRect();
      const popW = pop?.width ?? Math.max(rect.width, 176);
      const popH = pop?.height ?? 240;
      const gutter = 8;
      const left = clamp(rect.left, gutter, window.innerWidth - popW - gutter);
      const downTop = clamp(rect.bottom + 6, gutter, window.innerHeight - popH - gutter);
      const upTop = clamp(rect.top - popH - 6, gutter, window.innerHeight - popH - gutter);

      setStyle({
        left: `${Math.round(left)}px`,
        top: `${Math.round(placement === 'up' ? upTop : downTop)}px`,
        minWidth: `${Math.round(rect.width)}px`,
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, open, placement, popoverRef]);

  return style;
}

const pad = (n: number) => String(n).padStart(2, '0');

/* --- date ---------------------------------------------------------------- */

/** ISO `yyyy-mm-dd` -> `dd.mm.yyyy` for the manual field (matches the boards). */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}
/** `dd.mm.yyyy` (also tolerates `d.m.yyyy` and `-`/`/` separators) -> ISO or ''. */
function displayToIso(text: string): string {
  const m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(text.trim());
  if (!m) return '';
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function DateField({
  value,
  onChange,
  max,
}: {
  value: string; // ISO yyyy-mm-dd
  onChange: (iso: string) => void;
  max?: string; // ISO - days after this are disabled (e.g. "no future")
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState(() => isoToDisplay(value));
  const [view, setView] = useState(() => value || todayIso());

  // Sync the visible text when the value changes from the calendar — the
  // "store info from previous render" pattern (no setState-in-effect).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(isoToDisplay(value));
  }

  const localeTag = LOCALE_TAG[locale];
  const monthLabel = useMemo(() => {
    const [y, m] = view.split('-').map(Number);
    return new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1),
    );
  }, [view, localeTag]);

  const dow = useMemo(() => mondayFirstDow(localeTag), [localeTag]);
  const cells = useMemo(() => monthGrid(view), [view]);

  function commitText(next: string) {
    setText(next);
    const iso = displayToIso(next);
    if (iso) {
      onChange(iso);
      setView(iso);
    }
  }
  function shiftMonth(delta: number) {
    const [y, m] = view.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setView(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`);
  }

  return (
    <div className="picker">
      <div className="input-field" ref={anchorRef}>
        <input
          className="input"
          inputMode="numeric"
          placeholder={t.datePlaceholder}
          value={text}
          onChange={(e) => commitText(e.target.value)}
        />
        <button
          type="button"
          className="field-btn"
          aria-label={t.backfillDate}
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name="calendar-blank" />
        </button>
      </div>
      <Popover open={open} onClose={() => setOpen(false)} className="cal" anchorRef={anchorRef}>
        <div className="cal-head">
          <button
            type="button"
            className="cal-nav"
            aria-label={t.previousAction}
            onClick={() => shiftMonth(-1)}
          >
            <Icon name="caret-left" />
          </button>
          <span className="cal-title">{monthLabel}</span>
          <button
            type="button"
            className="cal-nav flip"
            aria-label={t.nextAction}
            onClick={() => shiftMonth(1)}
          >
            <Icon name="caret-left" />
          </button>
        </div>
        <div className="cal-dow">
          {dow.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((c) => {
            const disabled = !!max && c.iso > max;
            return (
              <button
                type="button"
                key={c.iso}
                className={`cal-day${c.iso === value ? ' sel' : ''}${
                  c.iso === todayIso() ? ' today' : ''
                }${c.muted ? ' muted' : ''}`}
                disabled={disabled}
                onClick={() => {
                  onChange(c.iso);
                  setView(c.iso);
                  setOpen(false);
                }}
              >
                {c.day}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="cal-today"
          onClick={() => {
            const iso = todayIso();
            onChange(iso);
            setView(iso);
            setOpen(false);
          }}
        >
          {t.today}
        </button>
      </Popover>
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Weekday initials, Monday-first, localized. */
function mondayFirstDow(localeTag: string): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag, { weekday: 'short' });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt
      .format(new Date(2024, 0, 1 + i))
      .replace('.', '')
      .slice(0, 2),
  );
}

/** 6x7 Monday-first grid of the month containing `view` (ISO). */
function monthGrid(view: string): { iso: string; day: number; muted: boolean }[] {
  const [y, m] = view.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const start = new Date(y, m - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      day: d.getDate(),
      muted: d.getMonth() !== m - 1,
    };
  });
}

/* --- time ---------------------------------------------------------------- */

function normalizeTime(text: string): string {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!m) return '';
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return '';
  return `${pad(h)}:${pad(mi)}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 5-min steps

export function TimeField({
  value, // "HH:MM"
  onChange,
}: {
  value: string;
  onChange: (hhmm: string) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  const [vh, vm] = value.split(':').map(Number);

  function commitText(next: string) {
    setText(next);
    const norm = normalizeTime(next);
    if (norm) onChange(norm);
  }
  function setPart(h: number, mi: number) {
    onChange(`${pad(h)}:${pad(mi)}`);
  }

  return (
    <div className="picker up">
      <div className="input-field" ref={anchorRef}>
        <input
          className="input"
          inputMode="numeric"
          placeholder={t.timePlaceholder}
          value={text}
          onChange={(e) => commitText(e.target.value)}
          onBlur={() => {
            const norm = normalizeTime(text);
            if (norm) setText(norm);
            else setText(value);
          }}
        />
        <button
          type="button"
          className="field-btn"
          aria-label={t.backfillStart}
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name="clock" />
        </button>
      </div>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        className="time"
        anchorRef={anchorRef}
        placement="up"
      >
        <div className="time-cols">
          <div className="time-col" role="listbox" aria-label={t.backfillStart}>
            {HOURS.map((h) => (
              <button
                type="button"
                key={h}
                className={`time-opt${h === vh ? ' sel' : ''}`}
                onClick={() => setPart(h, Number.isNaN(vm) ? 0 : vm)}
              >
                {pad(h)}
              </button>
            ))}
          </div>
          <span className="time-sep">:</span>
          <div className="time-col" role="listbox">
            {MINUTES.map((mi) => (
              <button
                type="button"
                key={mi}
                className={`time-opt${mi === vm ? ' sel' : ''}`}
                onClick={() => setPart(Number.isNaN(vh) ? 0 : vh, mi)}
              >
                {pad(mi)}
              </button>
            ))}
          </div>
        </div>
      </Popover>
    </div>
  );
}

/* --- duration ------------------------------------------------------------ */

const DURATIONS = [30, 45, 60, 75, 90, 105, 120, 180, 240, 360, 480, 720];

export function DurationField({
  value, // minutes
  onChange,
  min = 1,
  max = 1440, // up to 24h — long walks, all-day activities
}: {
  value: number;
  onChange: (min: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="picker up">
      <div className="input-field" ref={anchorRef}>
        <input
          className="input"
          type="number"
          min={min}
          max={max}
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button
          type="button"
          className="field-btn"
          aria-label={t.backfillDuration}
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name="timer" />
        </button>
      </div>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        className="dur"
        anchorRef={anchorRef}
        placement="up"
      >
        <div className="dur-list" role="listbox" aria-label={t.backfillDuration}>
          {DURATIONS.map((d) => (
            <button
              type="button"
              key={d}
              className={`dur-opt${d === value ? ' sel' : ''}`}
              onClick={() => {
                onChange(d);
                setOpen(false);
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

/* Locale tag map kept local so this file needs nothing exported from i18n. */
const LOCALE_TAG: Record<string, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};
