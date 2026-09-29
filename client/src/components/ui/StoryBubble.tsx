import type { ReactNode } from 'react';

import './StoryBubble.css';

/** Ring = what the face has to say: nothing, something new (brass), training
 *  now (green + dot), an alert (red, "!" badge), or Atlas (coral). */
export type StoryRing = 'default' | 'new' | 'live' | 'alert' | 'atlas';
export type StorySize = 'xs' | 'sm' | 'md' | 'lg';

/** Ring diameter per size (px). */
export const STORY_RING_PX: Record<StorySize, number> = { xs: 34, sm: 40, md: 50, lg: 62 };
/** The face inside the ring — size an avatar/portrait `media` to this. */
export const STORY_FACE_PX: Record<StorySize, number> = { xs: 26, sm: 32, md: 42, lg: 54 };

export interface StoryBubbleProps {
  /** Name under the bubble (one line, ellipsised). */
  label?: string;
  size?: StorySize;
  ring?: StoryRing;
  /** Avatar image / portrait, sized to `STORY_FACE_PX[size]`. */
  media?: ReactNode;
  /** Fallback when there is no media: the first letter is shown. */
  initial?: string;
  /** Count badge (top-right) or "!" for an alert. 0 / undefined = none. */
  badge?: number | '!';
  /** "+N more" bubble instead of a face (dashed ring). */
  more?: number;
  onClick?: () => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * One Instagram-stories bubble: a face in a state ring, an optional badge and a
 * name. Renders a <button> when `onClick` is given. Put several in a
 * `StoryRow`, split groups with `StoryDivider`.
 */
export function StoryBubble({
  label,
  size = 'lg',
  ring = 'default',
  media,
  initial,
  badge,
  more,
  onClick,
  className,
  ...rest
}: StoryBubbleProps) {
  const isMore = more !== undefined;
  const cls = [
    'uistory',
    `uistory--${size}`,
    `uistory--${isMore ? 'more' : ring}`,
    label == null ? 'uistory--bare' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const face = isMore ? (
    <span className="uistory-face uistory-face--more">+{more}</span>
  ) : (
    <span className="uistory-face">
      {media ?? (initial ? initial.trim().charAt(0).toUpperCase() : '')}
    </span>
  );
  const count =
    typeof badge === 'number' ? (badge > 9 ? '9+' : badge > 0 ? String(badge) : '') : '';
  const inner = (
    <>
      <span className="uistory-ring">
        {face}
        {!isMore && ring === 'live' && <span className="uistory-live" aria-hidden />}
        {!isMore && badge === '!' && (
          <span className="uistory-badge uistory-badge--alert" aria-hidden>
            !
          </span>
        )}
        {!isMore && count && (
          <span className="uistory-badge" aria-hidden>
            {count}
          </span>
        )}
      </span>
      {label != null && <span className="uistory-label">{label}</span>}
    </>
  );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={rest['aria-label']}>
        {inner}
      </button>
    );
  return (
    <span className={cls} aria-label={rest['aria-label']}>
      {inner}
    </span>
  );
}

/** Horizontally scrolling row of bubbles (no scrollbar). */
export function StoryRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['uistory-row', className].filter(Boolean).join(' ')}>{children}</div>;
}

/** Hairline between groups in a row (Atlas | clients). */
export function StoryDivider() {
  return <span className="uistory-divider" aria-hidden />;
}
