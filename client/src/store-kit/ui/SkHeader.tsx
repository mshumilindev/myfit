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
  /** Visible word on exit (it names where it goes): drawn as the Back link, left of the avatar. Without it exit is the bare icon disc. */
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
        {/* With a word, exit is the same accent text link as Back (chevron + label), left of the avatar; bare it is a disc. */}
        {onExit && exitText && (
          <button type="button" className="sk-hd-back" aria-label={exitLabel} onClick={onExit}>
            {exitIcon}
            <span>{exitText}</span>
          </button>
        )}
        {avatar}
        {onExit && !exitText && (
          <button
            type="button"
            className="sk-hd-exit"
            aria-label={exitLabel}
            title={exitLabel}
            onClick={onExit}
          >
            {exitIcon}
          </button>
        )}
      </div>
    </header>
  );
}
