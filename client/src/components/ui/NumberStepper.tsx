import { useState, type HTMLAttributes } from 'react';
import './NumberStepper.css';

export interface NumberStepperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Digits kept after the point (0 = integers). */
  decimals?: number;
  /** Unit shown after the value (kg, reps, s). */
  unit?: string;
  /** Shown instead of the value while disabled ("BW" for bodyweight). */
  placeholder?: string;
  /** `big` = the session set editor (32px value); `md` = plan / health (24px); `xl` = a hero value flanked by two large −/+ tiles (program weeks). */
  size?: 'md' | 'big' | 'xl';
  /** Highlight ring (the stepper the keypad / plate calculator targets). */
  focused?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
}

/**
 * The well stepper (kit `stepper` / .wstep): a recessed well with a caps
 * label, − / + and a typeable value. Typing keeps a draft (empty allowed) and
 * commits on blur / Enter, clamped to min…max and rounded to `decimals`.
 * Absorbs SessionView's Stepper, .stepper and views/programs/pieces Stepper.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  decimals = 0,
  unit,
  placeholder,
  size = 'md',
  focused,
  disabled,
  onFocus,
  className,
  ...rest
}: NumberStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function format(n: number): string {
    if (decimals <= 0) return String(n);
    const fixed = n.toFixed(decimals);
    return fixed.replace(/\.?0+$/, '') || '0';
  }
  function clamp(n: number): number {
    const rounded = decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n);
    return Math.min(max, Math.max(min, rounded));
  }
  function bump(dir: -1 | 1): void {
    const from =
      draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))
        ? Number(draft)
        : value;
    setDraft(null);
    onChange(clamp(from + dir * step));
  }
  function commit(raw: string): void {
    setDraft(null);
    if (raw.trim() === '') return; // keep the previous value — empty is fine while editing
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    onChange(clamp(n));
  }

  const shown = draft !== null ? draft : format(value);
  const cls = [
    'uistep',
    `uistep--${size}`,
    focused ? 'is-focused' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      role="group"
      aria-label={label}
      onClick={() => !disabled && onFocus?.()}
      {...rest}
    >
      <span className="uistep-l">{label}</span>
      <span className="uistep-row">
        {disabled && placeholder ? (
          <span className="uistep-v uistep-ph">{placeholder}</span>
        ) : (
          <>
            <button
              type="button"
              className="uistep-b"
              aria-label="−"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                bump(-1);
              }}
            >
              −
            </button>
            <input
              className="uistep-v"
              inputMode={decimals > 0 ? 'decimal' : 'numeric'}
              disabled={disabled}
              value={shown}
              aria-label={label}
              onFocus={() => {
                onFocus?.();
                setDraft(format(value));
              }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(draft ?? '')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            {unit && <span className="uistep-u">{unit}</span>}
            <button
              type="button"
              className="uistep-b"
              aria-label="+"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                bump(1);
              }}
            >
              +
            </button>
          </>
        )}
      </span>
    </div>
  );
}
