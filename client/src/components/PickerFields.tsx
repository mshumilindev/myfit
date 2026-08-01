/**
 * Date / time / duration pickers for the backfill sheet (and anywhere a past
 * value is entered). Each field keeps MANUAL text entry as the source of truth
 * and layers a Nocturne-styled visual picker on top — no native browser widget
 * (those ignore the graphite/brass tokens) and no third-party lib (offline PWA,
 * pixel-parity with the boards). Design: docs/DESIGN.md.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { Icon } from '../ui';

/* --- shared popover shell ------------------------------------------------- */

function Popover({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`picker-pop${className ? ` ${className}` : ''}`} ref={ref} role="dialog">
      {children}
    </div>
  );
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
      <div className="input-field">
        <input
          className="input"
          inputMode="numeric"
          placeholder="dd.mm.yyyy"
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
      <Popover open={open} onClose={() => setOpen(false)} className="cal">
        <div className="cal-head">
          <button
            type="button"
            className="cal-nav"
            aria-label="prev"
            onClick={() => shiftMonth(-1)}
          >
            <Icon name="caret-left" />
          </button>
          <span className="cal-title">{monthLabel}</span>
          <button
            type="button"
            className="cal-nav flip"
            aria-label="next"
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
      <div className="input-field">
        <input
          className="input"
          inputMode="numeric"
          placeholder="hh:mm"
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
      <Popover open={open} onClose={() => setOpen(false)} className="time">
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

const DURATIONS = [30, 45, 60, 75, 90, 105, 120];

export function DurationField({
  value, // minutes
  onChange,
  min = 1,
  max = 480,
}: {
  value: number;
  onChange: (min: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="picker up">
      <div className="input-field">
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
      <Popover open={open} onClose={() => setOpen(false)} className="dur">
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
