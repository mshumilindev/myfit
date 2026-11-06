import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-d.css';
import './SkHeader.css';

export interface SkHeaderProps {
  /** Root screens: the screen title (h1). Ignored when `onBack` is set. */
  title?: ReactNode;
  /** Detail screens: shows the back button instead of the title. */
  onBack?: () => void;
  backLabel?: string;
  backIcon?: ReactNode;
  /** Usually an `SkAvatar` button. */
  avatar?: ReactNode;
  /** Exit-to-Spotter: a labelled icon button to the right of the avatar. Rendered when `onExit` is set. */
  onExit?: () => void;
  exitLabel?: string;
  exitIcon?: ReactNode;
  /** Visible word on the exit button (it names where the button goes). Without it the button is the bare icon disc. */
  exitText?: string;
  className?: string;
}

/** Mobile app header, uniform 44px: title or back on the left; avatar + exit on the right. */
export function SkHeader({
  title,
  onBack,
  backLabel,
  backIcon,
  avatar,
  onExit,
  exitLabel,
  exitIcon,
  exitText,
  className,
}: SkHeaderProps) {
  return (
    <header className={cx('sk-hd', className)}>
      {onBack ? (
        <button type="button" className="sk-hd-back" onClick={onBack}>
          {backIcon}
          <span>{backLabel}</span>
        </button>
      ) : (
        <h1 className="sk-t-h1 sk-hd-title">{title}</h1>
      )}
      <div className="sk-hd-end">
        {avatar}
        {onExit && (
          <button
            type="button"
            className={cx('sk-hd-exit', exitText && 'sk-hd-exit-text')}
            aria-label={exitLabel}
            title={exitLabel}
            onClick={onExit}
          >
            {exitIcon}
            {exitText && <span>{exitText}</span>}
          </button>
        )}
      </div>
    </header>
  );
}
