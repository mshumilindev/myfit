import type { CSSProperties, ReactNode } from 'react';
import { toneClass, type Tone } from './tones';
import './PresetChips.css';

export interface PresetChip {
  id: string;
  label: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
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
  size?: 'sm' | 'md';
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
  size = 'md',
}: PresetChipsProps) {
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
