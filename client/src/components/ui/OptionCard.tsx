import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { toneClass, type Tone } from './tones';
import './OptionCard.css';

export interface OptionCardProps {
  title: ReactNode;
  sub?: ReactNode;
  /** A small sketch of what the option looks like, drawn above the text. */
  preview?: ReactNode;
  /**
   * Leading glyph (an <IconTile size={30}>). Switches the card to the ListRow layout: icon ·
   * title + description column (description under the title's left edge) · the selected check
   * vertically centred at the end. Use for pickers of named choices; use `preview` for sketches.
   */
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Colour family of the selected state. */
  tone?: Tone;
  className?: string;
}

/**
 * One choice of a one-of-N picker shown as a card: a mini preview, a title and
 * a sub-line, a check in the corner when selected (Today block settings:
 * Together / Split, Atlas view…). Put the cards in an <OptionCardGrid>.
 */
export function OptionCard({
  title,
  sub,
  preview,
  icon,
  selected,
  onSelect,
  disabled,
  tone = 'accent',
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      className={[
        'uiopt',
        icon != null ? 'uiopt--row' : '',
        toneClass(tone),
        selected ? 'is-on' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      {preview != null && (
        <span className="uiopt-pv" aria-hidden="true">
          {preview}
        </span>
      )}
      {icon != null && (
        <span className="uiopt-ic" aria-hidden="true">
          {icon}
        </span>
      )}
      {icon != null ? (
        <span className="uiopt-tx">
          <span className="uiopt-t">{title}</span>
          {sub != null && <span className="uiopt-s">{sub}</span>}
        </span>
      ) : (
        <>
          <span className="uiopt-t">{title}</span>
          {sub != null && <span className="uiopt-s">{sub}</span>}
        </>
      )}
      {selected && (
        <span className="uiopt-check" aria-hidden="true">
          <Icon name="check" weight="bold" />
        </span>
      )}
    </button>
  );
}

/** Two-column grid of option cards (the group gets an accessible name). */
export function OptionCardGrid({
  children,
  label,
  columns = 2,
}: {
  children: ReactNode;
  label?: string;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className="uiopt-grid"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
