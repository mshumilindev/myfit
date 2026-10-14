import type { CSSProperties, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './PresetChips.css';

export interface PresetChip {
  id: string;
  label: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** Spoken name of a read-only chip ("Tue, session with the trainer"). */
  ariaLabel?: string;
  onClick?: () => void;
}

export interface PresetChipsProps {
  items: PresetChip[];
  /** Colour family of the selected chip. */
  tone?: Tone;
  /**
   * `wrap` (default) never clips; `scroll` keeps one line and scrolls; `grid` lays the chips
   * out as equal columns on one line (a row of weekdays), the label centred.
   */
  layout?: 'wrap' | 'scroll' | 'grid';
  /** Accessible name of the group. */
  label?: string;
  /** Control scale step (styles.css --ctl-h-*): xs 28 / sm 36 (default) / md 44 / lg 52. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Show-only: the chips are list items, not buttons (a week with its training days marked, nothing
   * to press). `selected` marks the on ones; give each an `ariaLabel` to say what "on" means.
   */
  readOnly?: boolean;
}

/**
 * Toggle chips for quick picks — date presets over a Calendar, body parts,
 * filters. Each chip is a button with aria-pressed; the selected one takes
 * the tone's tint / base.
 */
export function PresetChips({
  items,
  tone = 'accent',
  layout = 'wrap',
  label,
  size = 'sm',
  readOnly = false,
}: PresetChipsProps) {
  if (readOnly) {
    return (
      <ul
        className={`uipc uipc--${layout} uipc--${size} uipc--static ${toneClass(tone)}`}
        aria-label={label}
        style={layout === 'grid' ? ({ '--uipc-cols': items.length } as CSSProperties) : undefined}
      >
        {items.map((it) => (
          <li
            key={it.id}
            className={`uipc-chip${it.selected ? ' is-on' : ''}`}
            aria-label={it.ariaLabel}
          >
            {it.label}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div
      className={`uipc uipc--${layout} uipc--${size} ${toneClass(tone)}`}
      role="group"
      aria-label={label}
      style={layout === 'grid' ? ({ '--uipc-cols': items.length } as CSSProperties) : undefined}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`uipc-chip${it.selected ? ' is-on' : ''}`}
          aria-pressed={!!it.selected}
          disabled={it.disabled}
          onClick={it.onClick}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
