import { useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { WheelColumn, type WheelItem } from './WheelColumn';
import './WheelPicker.css';

export interface WheelPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  unit?: string;
  /** Shown instead of the drum while disabled ("BW" for a bodyweight set) — same contract as NumberStepper. */
  placeholder?: string;
  /**
   * `wheel` = the drum alone; `manual` = + tap the centre value to type it; `stepper` = + tap-to-type and − / + beside it.
   * (SPO-318 variants A3 / A1 / A2.)
   */
  input?: 'wheel' | 'manual' | 'stepper' | 'native';
  /** `single` = one drum of all values; `split` = whole | fraction drums (82 , 5). */
  columns?: 'single' | 'split';
  /** `compact` = 3 visible rows (dense session screen); `md` / `big` = 5 rows. */
  size?: 'compact' | 'md' | 'big';
  focused?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
  /** A row passed the selection band while spinning — wire a haptic / sound here (see `wheelFeedback.ts`). */
  onDetent?: () => void;
  /** The drum was touched (a user gesture): unlock audio here. */
  onGrab?: () => void;
}

function fmt(n: number, decimals: number): string {
  if (decimals <= 0) return String(n);
  return n.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}

/** A number picked on a scroll-snap drum — the wheel counterpart of NumberStepper (same value contract). */
export function WheelPicker({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100,
  decimals = 0,
  unit,
  placeholder,
  input = 'manual',
  columns = 'single',
  size = 'md',
  focused,
  disabled,
  onFocus,
  onDetent,
  onGrab,
  className,
  ...rest
}: WheelPickerProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  // a tap on the selected number (not a drag) opens the keyboard; the field itself never takes the pointer, so a drag may start on it
  const openKeyboard = () => editRef.current?.focus();
  const snap = (n: number): number =>
    Math.min(max, Math.max(min, Number((Math.round((n - min) / step) * step + min).toFixed(4))));
  // The value as held (kept when off the step grid), clamped to the range; `snap` is only for what the person picks.
  const cur = Number.isFinite(value)
    ? Math.min(max, Math.max(min, Number(value.toFixed(decimals + 2))))
    : min;

  const grid = useMemo<WheelItem[]>(() => {
    const out: WheelItem[] = [];
    const n = Math.round((max - min) / step);
    for (let i = 0; i <= n; i++) {
      const v = Number((min + i * step).toFixed(4));
      out.push({ key: String(v), label: fmt(v, decimals) });
    }
    return out;
  }, [min, max, step, decimals]);
  // A stored value off the step grid (61.25 on a 0.5 grid) stays selectable, so the drum never shows a different
  // number than the one the set holds.
  const all = useMemo<WheelItem[]>(() => {
    if (grid.some((x) => Number(x.key) === cur)) return grid;
    return [...grid, { key: String(cur), label: fmt(cur, Math.max(decimals, 2)) }].sort(
      (x, y) => Number(x.key) - Number(y.key),
    );
  }, [grid, cur, decimals]);
  const idx = Math.max(
    0,
    all.findIndex((x) => Number(x.key) === cur),
  );

  const whole = useMemo(() => {
    const w: WheelItem[] = [];
    for (let i = Math.floor(min); i <= Math.floor(max); i++)
      w.push({ key: String(i), label: String(i) });
    return w;
  }, [min, max]);
  const fracs = useMemo(() => {
    const f: WheelItem[] = [];
    const n = decimals > 0 ? Math.round(1 / step) : 1;
    for (let i = 0; i < n; i++) {
      const t = (i * step).toFixed(decimals).split('.')[1] ?? '0';
      f.push({ key: String(i), label: decimals > 0 ? t : '0' });
    }
    return f;
  }, [step, decimals]);

  const wi = Math.floor(cur) - Math.floor(min);
  const fi = Math.max(0, Math.round((cur - Math.floor(cur)) / step));
  function setSplit(w: number, f: number): void {
    onChange(snap(Math.floor(min) + w + f * step));
  }

  function commit(raw: string): void {
    setDraft(null);
    const n = Number(raw.replace(',', '.'));
    // Tapping into the field and leaving it untouched must not re-round a stored value that sits off the step grid.
    if (raw.trim() !== '' && Number.isFinite(n) && n !== cur) onChange(snap(n));
  }
  const bump = (d: -1 | 1): void => onChange(snap(cur + d * step));
  const typeable = input === 'manual' || input === 'stepper';
  const text = `${fmt(cur, Math.max(decimals, 2))}${unit ? ` ${unit}` : ''}`;

  const cls = [
    'uiwp',
    `uiwp--${size}`,
    `uiwp--${input}`,
    `uiwp--${columns}`,
    focused ? 'is-focused' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (disabled && placeholder) {
    return (
      <div className={cls} role="group" aria-label={label} {...rest}>
        <span className="uiwp-l">{label}</span>
        <span className="uiwp-ph">{placeholder}</span>
      </div>
    );
  }

  if (input === 'native') {
    // The OS's own picker: a plain <select> opens the system wheel on iOS and the system list on Android / desktop.
    return (
      <div
        className={cls}
        role="group"
        aria-label={label}
        onClick={() => !disabled && onFocus?.()}
        {...rest}
      >
        <span className="uiwp-l">{label}</span>
        <div className="uiwp-row">
          <select
            className="uiwp-native"
            aria-label={label}
            disabled={disabled}
            value={String(cur)}
            onChange={(e) => onChange(Number(e.target.value))}
            onFocus={onFocus}
          >
            {all.map((it) => (
              <option key={it.key} value={it.key}>
                {it.label}
              </option>
            ))}
          </select>
          {unit && <span className="uiwp-u">{unit}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cls}
      role="group"
      aria-label={label}
      onClick={() => !disabled && onFocus?.()}
      {...rest}
    >
      <span className="uiwp-l">{label}</span>
      <div className="uiwp-row">
        {input === 'stepper' && (
          <button
            type="button"
            className="uiwp-b"
            aria-label="−"
            disabled={disabled}
            onClick={() => bump(-1)}
          >
            −
          </button>
        )}
        <div className="uiwp-drum">
          {columns === 'single' ? (
            <WheelColumn
              label={label}
              items={all}
              index={idx}
              onIndex={(i) => onChange(Number(all[i].key))}
              valueText={text}
              unit={unit}
              disabled={disabled}
              onFocus={onFocus}
              onTapSelected={openKeyboard}
              onDetent={onDetent}
              onGrab={onGrab}
            />
          ) : (
            <>
              <WheelColumn
                label={`${label}`}
                items={whole}
                index={wi}
                onIndex={(i) => setSplit(i, fi)}
                valueText={text}
                disabled={disabled}
                onFocus={onFocus}
                onTapSelected={openKeyboard}
                onDetent={onDetent}
                onGrab={onGrab}
              />
              {decimals > 0 && (
                <span className="uiwp-dot" aria-hidden="true">
                  ,
                </span>
              )}
              {decimals > 0 && (
                <WheelColumn
                  label={`${label} ·`}
                  items={fracs}
                  index={fi}
                  onIndex={(i) => setSplit(wi, i)}
                  valueText={text}
                  unit={unit}
                  disabled={disabled}
                  onFocus={onFocus}
                  onTapSelected={openKeyboard}
                  onDetent={onDetent}
                  onGrab={onGrab}
                />
              )}
            </>
          )}
          {typeable && (
            <input
              ref={editRef}
              className="uiwp-edit"
              inputMode={decimals > 0 ? 'decimal' : 'numeric'}
              aria-label={`${label} (type)`}
              disabled={disabled}
              value={draft ?? ''}
              placeholder=""
              onFocus={() => {
                onFocus?.();
                setDraft(fmt(cur, Math.max(decimals, 2)));
              }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(draft ?? '')}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          )}
        </div>
        {input === 'stepper' && (
          <button
            type="button"
            className="uiwp-b"
            aria-label="+"
            disabled={disabled}
            onClick={() => bump(1)}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
