import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { IconTile } from './IconTile';
import { toneClass, type Tone } from './tones';
import './ShortcutTile.css';

/** XS shortcut states (design: library › Shortcuts XS). */
export type ShortcutState = 'default' | 'live' | 'done' | 'selected';

export interface ShortcutTileProps {
  label: ReactNode;
  icon: string;
  tone?: Tone;
  state?: ShortcutState;
  /** Solid brass tile — only "Today's day ▶". */
  primary?: boolean;
  /** Live timer etc., shown instead of the label's second line. */
  meta?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}

/** XS — one-tap action on Today: start the program day, log an activity… */
export function ShortcutTile({
  label,
  icon,
  tone = 'neutral',
  state = 'default',
  primary = false,
  meta,
  onClick,
  ariaLabel,
}: ShortcutTileProps) {
  const cls = ['uisc', toneClass(tone), `uisc--${state}`, primary ? 'uisc--primary' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={state === 'selected' ? true : undefined}
    >
      {primary ? (
        <span className="uisc-primary-icon">
          <Icon name={icon} />
        </span>
      ) : (
        <IconTile tone="inherit" size={36} icon={icon} />
      )}
      <span className="uisc-label">{label}</span>
      {meta != null && <span className="uisc-meta">{meta}</span>}
      {state === 'live' && <span className="uisc-dot" aria-hidden="true" />}
      {state === 'selected' && (
        <span className="uisc-pick" aria-hidden="true">
          <Icon name="check" weight="bold" />
        </span>
      )}
      {state === 'done' && (
        <span className="uisc-done" aria-hidden="true">
          <Icon name="check" />
        </span>
      )}
    </button>
  );
}
