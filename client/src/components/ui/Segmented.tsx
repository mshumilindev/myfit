import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Badge, badgeText } from './Badge';
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
  /**
   * Count chip after the label. A number renders the kit `Badge` (neutral,
   * 1..9, "9+", 0 hidden) and, for a text label without `ariaLabel`, is added
   * to the accessible name ("Programs, 3"). Any other node is placed as given.
   */
  badge?: ReactNode;
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
  /** Control scale step (styles.css --ctl-h-*): sm 36 / md 44 (default) / lg 52 — the OUTER height of the control. */
  size?: 'sm' | 'md' | 'lg';
  /** Options size to their label (chip-like row) instead of equal columns. */
  hug?: boolean;
  /**
   * Equal-width segments across the whole container, even when `hug` is set
   * (Coach mode switch, share picker). Equal paddings: selected == unselected.
   */
  fill?: boolean;
  /** One row that scrolls sideways when the options do not fit (many options in a narrow container). */
  scroll?: boolean;
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
  fill = false,
  scroll = false,
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
        fill ? 'uiseg--fill' : '',
        scroll ? 'uiseg--scroll' : '',
        stacked ? 'uiseg--stack' : '',
        toneClass(tone),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      aria-labelledby={labelledBy}
      style={
        hug || fill || scroll
          ? undefined
          : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }
      }
    >
      {options.map((o) => {
        const on = o.value === value;
        const count = typeof o.badge === 'number' ? badgeText(o.badge) : '';
        const name =
          o.ariaLabel ??
          (count && typeof o.label === 'string' ? `${o.label}, ${count}` : undefined);
        return (
          <button
            key={String(o.value)}
            type="button"
            className={`uiseg-opt${on ? ' is-on' : ''}${o.compact ? ' is-compact' : ''}`}
            role={tabs ? 'tab' : undefined}
            aria-pressed={tabs ? undefined : on}
            aria-selected={tabs ? on : undefined}
            aria-label={name}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <Icon name={o.icon} weight={stacked ? 'regular' : undefined} />}
            <span className="uiseg-l">{o.label}</span>
            {typeof o.badge === 'number' ? (
              <Badge n={o.badge} tone="neutral" className="uiseg-badge" />
            ) : (
              o.badge
            )}
          </button>
        );
      })}
    </div>
  );
}
