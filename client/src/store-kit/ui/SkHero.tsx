import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../cx';
import '../tokens-c.css';
import './SkHero.css';

/** Discover progress hero states (boards 22–24): progress / almost complete / complete / new item arrives. */
export type SkHeroState = 'progress' | 'almost' | 'complete' | 'new';

export interface SkHeroProps {
  state?: SkHeroState;
  eyebrow: string;
  done: number;
  total: number;
  /** Overrides the computed percentage (0..100). */
  percent?: number;
  /** Status badge at the right (Complete, New). */
  badge?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Accessible name of the bar; defaults to the eyebrow. */
  progressLabel?: string;
  className?: string;
}

export function SkHero({
  state = 'progress',
  eyebrow,
  done,
  total,
  percent,
  badge,
  title,
  body,
  progressLabel,
  className,
}: SkHeroProps) {
  const raw = percent ?? (total > 0 ? (done / total) * 100 : 0);
  const pct = Math.max(0, Math.min(100, Math.round(raw)));
  return (
    <section className={cx('sk-hero', `sk-hero-${state}`, className)} data-state={state}>
      <div className="sk-hero-top">
        <div>
          <div className="sk-hero-eyebrow">{eyebrow}</div>
          <div className="sk-hero-big">
            {done}
            <span className="sk-hero-of"> / {total}</span>
          </div>
        </div>
        {badge}
      </div>
      <div
        className="sk-hero-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={progressLabel ?? eyebrow}
      >
        <i style={{ '--sk-hero-pct': `${pct}%` } as CSSProperties} />
      </div>
      <div className="sk-hero-title">{title}</div>
      {body && <div className="sk-hero-body">{body}</div>}
    </section>
  );
}
