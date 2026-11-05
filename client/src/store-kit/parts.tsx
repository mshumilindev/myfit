/**
 * Add-on Store kit primitives (ADR 015): the store's own components, styled by `store-kit.css` under `.sk-root`.
 * Not the app UI kit — the store has its own look.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SK_ICONS, type SkIconName } from './icons';
import './store-kit.css';
import './store-kit-layout.css';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function SkIcon({ name, small }: { name: SkIconName; small?: boolean }) {
  return (
    <svg className={cx('sk-svg', small && 'sk-svg-s')} viewBox="0 0 24 24" aria-hidden="true">
      <path d={SK_ICONS[name]} />
    </svg>
  );
}

export type SkBtnKind = 'pri' | 'tint' | 'ghost' | 'dash' | 'bad' | 'inv' | 'ok';
export function SkBtn({
  kind = 'tint',
  size,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: SkBtnKind; size?: 'l' | 's' }) {
  return (
    <button
      type="button"
      className={cx('sk-bt', `sk-bt-${kind}`, size && `sk-bt-${size}`, className)}
      {...rest}
    />
  );
}

export function SkBadge({
  kind,
  children,
}: {
  kind: 'app' | 'add' | 'soon' | 'ok' | 'new';
  children: ReactNode;
}) {
  return <span className={cx('sk-bd', `sk-bd-${kind}`)}>{children}</span>;
}

/** Coloured app tile with a letter. `tone` 0..9 is the app colour family. */
export function SkTile({
  letter,
  tone,
  size,
}: {
  letter: string;
  tone: number;
  size?: 32 | 40 | 64 | 96;
}) {
  return (
    <span className={cx('sk-ic', size && `sk-ic${size}`, `sk-i${tone}`)} aria-hidden="true">
      {letter}
    </span>
  );
}

export function SkChip({
  on,
  children,
  onClick,
}: {
  on?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cx('sk-chip', on && 'sk-on')}
      onClick={onClick}
      aria-pressed={on}
    >
      {children}
    </button>
  );
}

export function SkCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('sk-card', className)}>{children}</div>;
}

/** Card whose children are `SkRow`s. */
export function SkList({ children }: { children: ReactNode }) {
  return <div className="sk-card sk-px16 sk-list">{children}</div>;
}

export function SkRow({
  tile,
  name,
  desc,
  badge,
  rel,
  action,
  onOpen,
}: {
  tile: ReactNode;
  name: ReactNode;
  desc?: ReactNode;
  badge?: ReactNode;
  rel?: string | null;
  action?: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div className="sk-row">
      {tile}
      <div
        className={cx('sk-f1', onOpen && 'sk-tap')}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="sk-t-b sk-b6">{name}</div>
        {desc && <div className="sk-t-s">{desc}</div>}
        <div className="sk-rowf sk-g8 sk-mt4 sk-wrap">
          {badge}
          {rel && (
            <span className="sk-rel">
              <SkIcon name="link" small />
              {rel}
            </span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Installed is a status, not a button. */
export function SkInstalledLabel({ children }: { children: ReactNode }) {
  return (
    <span className="sk-inst-lbl">
      <SkIcon name="check" small />
      {children}
    </span>
  );
}

export function SkSearchField({
  value,
  placeholder,
  onChange,
  onFocus,
  onClear,
  clearLabel,
  autoFocus,
}: {
  value: string;
  placeholder: string;
  onChange?: (v: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
  clearLabel?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className={cx('sk-search', value && 'sk-on')}>
      <SkIcon name="search" />
      <input
        className="sk-search-in"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {value && onClear && (
        <button type="button" className="sk-search-x" aria-label={clearLabel} onClick={onClear}>
          <SkIcon name="x" small />
        </button>
      )}
    </label>
  );
}

export function SkAvatar({
  initials,
  label,
  onClick,
  size = 36,
}: {
  initials: string;
  label: string;
  onClick?: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      className="sk-av sk-avbtn"
      style={{ width: size, height: size }}
      aria-label={label}
      onClick={onClick}
    >
      {initials}
    </button>
  );
}
