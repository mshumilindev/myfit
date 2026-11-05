import type { ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-c.css';
import './SkBentoTile.css';

export type SkBentoVariant = 'white' | 'dark' | 'accent' | 'tone';
export type SkBentoSize = 'default' | 'hero' | 'wide';
export type SkBentoTitleSize = 'hero' | 'h2' | 'h3';

export interface SkBentoTileProps {
  /** Surface. `tone` uses the app colour family given by `tone` (0..9). */
  variant?: SkBentoVariant;
  tone?: number;
  size?: SkBentoSize;
  /** Span both columns of the grid. */
  span?: 2;
  eyebrow?: ReactNode;
  /** Right of the eyebrow (e.g. a badge). */
  aside?: ReactNode;
  title?: ReactNode;
  titleSize?: SkBentoTitleSize;
  /** Makes the title a button (only for a tile that is not clickable as a whole). */
  onTitle?: () => void;
  /** A large figure (stat tiles). */
  big?: ReactNode;
  body?: ReactNode;
  /** Free content between body and footer. */
  children?: ReactNode;
  /** Pinned to the bottom (action button or link). */
  footer?: ReactNode;
  /** Whole tile becomes a real button. Do not put buttons inside then. */
  onClick?: () => void;
  /** Accessible name for a clickable tile; defaults to its text. */
  label?: string;
  className?: string;
}

export function SkBentoTile({
  variant = 'white',
  tone,
  size = 'default',
  span,
  eyebrow,
  aside,
  title,
  titleSize,
  onTitle,
  big,
  body,
  children,
  footer,
  onClick,
  label,
  className,
}: SkBentoTileProps) {
  const kind = tone !== undefined ? 'tone' : variant;
  const cls = cx(
    'sk-btile',
    `sk-btile-${kind}`,
    kind === 'tone' && `sk-btile-g${tone}`,
    size !== 'default' && `sk-btile-${size}`,
    span === 2 && 'sk-btile-span2',
    onClick && 'sk-btile-btn',
    className,
  );
  const ts = titleSize ?? (size === 'hero' ? 'hero' : 'h2');
  const inner = (
    <>
      {(eyebrow || aside) && (
        <span className="sk-btile-top">
          <span className="sk-btile-eyebrow">{eyebrow}</span>
          {aside}
        </span>
      )}
      {title &&
        (onTitle && !onClick ? (
          <button
            type="button"
            className={cx('sk-btile-title', `sk-btile-t-${ts}`)}
            onClick={onTitle}
          >
            {title}
          </button>
        ) : (
          <span className={cx('sk-btile-title', `sk-btile-t-${ts}`)}>{title}</span>
        ))}
      {big !== undefined && <span className="sk-btile-big">{big}</span>}
      {body && <span className="sk-btile-body">{body}</span>}
      {children}
      {footer && <span className="sk-btile-foot">{footer}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Text link at the bottom of a tile ("See all ›"). A button when `onClick` is set, plain text inside a clickable tile. */
export function SkBentoLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return onClick ? (
    <button type="button" className="sk-btile-link" onClick={onClick}>
      {children}
    </button>
  ) : (
    <span className="sk-btile-link">{children}</span>
  );
}
