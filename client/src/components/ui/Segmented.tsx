import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './Segmented.css';

export interface SegmentedOption<V extends string | number> {
  value: V;
  label: ReactNode;
  /** Phosphor icon before the label. */
  icon?: string;
  /** Accessible name when the visible label is short ("Custom" → "Custom minutes"). */
  ariaLabel?: string;
  disabled?: boolean;
  /** Smaller type for a long label in a narrow segment. */
  compact?: boolean;
}

export interface SegmentedProps<V extends string | number> {
  options: SegmentedOption<V>[];
  /** Selected value; null = nothing selected. */
  value: V | null;
  onChange: (value: V) => void;
  /** Accessible name of the group. */
  label?: string;
  labelledBy?: string;
  /**
   * `track` — iOS segmented control (one grey track, the selected segment
   * raised). `buttons` — separate outlined buttons, the selected one in the
   * tone's tint (Log activity's duration / when / effort pickers).
   */
  variant?: 'track' | 'buttons';
  tone?: Tone;
  /** Tab semantics (tablist / tab / aria-selected) for pickers that switch a panel. */
  tabs?: boolean;
  size?: 'sm' | 'md';
  /** Options size to their label (chip-like row) instead of equal columns. */
  hug?: boolean;
  /** Icon above the label (a row of small tiles, e.g. an illness kind). */
  stacked?: boolean;
  className?: string;
}

/** One-of-N picker. Each option is a button with aria-pressed. */
export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  variant = 'track',
  tone = 'accent',
  size = 'md',
  tabs,
  hug = false,
  stacked = false,
  className,
}: SegmentedProps<V>) {
  return (
    <div
      className={[
        'uiseg',
        `uiseg--${variant}`,
        `uiseg--${size}`,
        options.length >= 5 ? 'is-dense' : '',
        hug ? 'uiseg--hug' : '',
        stacked ? 'uiseg--stack' : '',
        toneClass(tone),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      aria-labelledby={labelledBy}
      style={hug ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            className={`uiseg-opt${on ? ' is-on' : ''}${o.compact ? ' is-compact' : ''}`}
            role={tabs ? 'tab' : undefined}
            aria-pressed={tabs ? undefined : on}
            aria-selected={tabs ? on : undefined}
            aria-label={o.ariaLabel}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <Icon name={o.icon} weight={stacked ? 'regular' : undefined} />}
            <span className="uiseg-l">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
