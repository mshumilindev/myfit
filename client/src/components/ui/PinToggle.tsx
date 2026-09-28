import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Switch } from './Switch';
import { toneClass, type Tone } from './tones';
import './PinToggle.css';

export interface PinToggleProps {
  pinned: boolean;
  onToggle: () => void;
  /** Accessible name, e.g. "Pin Tennis" / "Unpin Tennis". */
  label: string;
  /**
   * `icon` — bare pin glyph (44px target), toned when pinned.
   * `boxed` — pin in a small outlined box, filled when pinned (card corners).
   * `row` — full-width bordered row: pin · text · small switch.
   */
  variant?: 'icon' | 'boxed' | 'row';
  /** Row variant: the visible text. */
  text?: ReactNode;
  /** Colour family when pinned; `inherit` reads --t-* from a toned ancestor. */
  tone?: Tone | 'inherit';
  className?: string;
}

/** Pin / unpin an item to the top of a list. Stops click propagation so it
 *  can sit inside a clickable card. */
export function PinToggle({
  pinned,
  onToggle,
  label,
  variant = 'icon',
  text,
  tone = 'accent',
  className,
}: PinToggleProps) {
  const tc = tone === 'inherit' ? '' : toneClass(tone);
  if (variant === 'row') {
    return (
      <label className={['uipin-row', tc, className].filter(Boolean).join(' ')}>
        <Icon name="push-pin" weight={pinned ? 'fill' : 'bold'} />
        <span className="uipin-row-t">{text}</span>
        <Switch
          checked={pinned}
          onChange={() => onToggle()}
          size="sm"
          tone={tone}
          aria-label={label}
        />
      </label>
    );
  }
  return (
    <button
      type="button"
      className={['uipin', `uipin--${variant}`, pinned ? 'is-on' : '', tc, className]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-pressed={pinned}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className="uipin-g">
        <Icon name="push-pin" weight={pinned ? 'fill' : 'bold'} />
      </span>
    </button>
  );
}
