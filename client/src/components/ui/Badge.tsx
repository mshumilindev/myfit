import './Badge.css';

/** Counts above this render as "9+" (R-FE-010). */
export const BADGE_MAX = 9;

/**
 * The one count-badge text rule: 1..9 as the number, above 9 "9+", zero /
 * negative / non-finite hidden (empty string). Every unread count in the app
 * (rail, tab bar, bell, story bubble, chat rows) goes through this.
 */
export function badgeText(n: number, max: number = BADGE_MAX): string {
  if (!Number.isFinite(n)) return '';
  const whole = Math.floor(n);
  if (whole <= 0) return '';
  return whole > max ? `${max}+` : String(whole);
}

export type BadgeTone = 'danger' | 'accent' | 'neutral';
export type BadgeSize = 'sm' | 'md';
/**
 * `corner` — absolutely placed at the host's top-right (the host must be
 * `position: relative`; the offset is identical on every rail / tab).
 * `inline` — flows in a row, pushed to the end (`margin-left: auto`).
 * `none` — plain inline pill, the caller places it.
 */
export type BadgeAnchor = 'corner' | 'inline' | 'none';

export interface BadgeProps {
  /** The count. 0 (or less) renders nothing. */
  n: number;
  /** Counts above this show as "max+". Default 9. */
  max?: number;
  tone?: BadgeTone;
  /** `sm` 18px (default) or `md` 20px. */
  size?: BadgeSize;
  anchor?: BadgeAnchor;
  /** Visually hidden word after the glyph for assistive tech ("unread"). The
   *  glyph itself is `aria-hidden`; the host supplies the full aria-label. */
  label?: string;
  className?: string;
}

/**
 * Count badge (kit `badge`): a min-18px pill, 12px bold (the only place 12px is
 * allowed), white on solid red, >= 4.5:1. Renders nothing for a zero count.
 */
export function Badge({
  n,
  max = BADGE_MAX,
  tone = 'danger',
  size = 'sm',
  anchor = 'none',
  label,
  className,
}: BadgeProps) {
  const text = badgeText(n, max);
  if (!text) return null;
  const cls = ['uibadge', `uibadge--${tone}`, `uibadge--${size}`, `uibadge--${anchor}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} data-count={n}>
      <span aria-hidden>{text}</span>
      {label != null && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
