/** Full-screen preview slider (SPO-556): opens from any preview in the store; arrows, swipe, dots and the keyboard move between shots. */
import './viewer.css';
import { useEffect, useRef, useState } from 'react';
import { APP_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import { SkIcon } from '../store-kit';
import type { StoreCtx } from './storeItems';
import { previewUrl } from './weekPreviews';

export function PreviewViewer({
  shots,
  start,
  title,
  ctx,
  onClose,
}: {
  shots: readonly string[];
  start: number;
  title: string;
  ctx: StoreCtx;
  onClose: () => void;
}) {
  const { st } = ctx;
  const wide = useMinWidth(APP_BREAKPOINT);
  const [idx, setIdx] = useState(Math.min(start, shots.length - 1));
  const ref = useRef<HTMLDivElement>(null);
  const n = shots.length;
  const go = (i: number) => setIdx(Math.max(0, Math.min(n - 1, i)));
  useEffect(() => {
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const touch = useRef<number | null>(null);
  return (
    <div
      ref={ref}
      className="as-pv"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        } else if (e.key === 'ArrowRight') go(idx + 1);
        else if (e.key === 'ArrowLeft') go(idx - 1);
      }}
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = touch.current;
        touch.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return;
        go(idx + (x1 < x0 ? 1 : -1));
      }}
    >
      <div className="as-pv-bar">
        <span className="as-pv-title">{title}</span>
        <button type="button" className="as-pv-x" aria-label={st.close} onClick={onClose}>
          <SkIcon name="x" />
        </button>
      </div>
      <div className="as-pv-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img
          key={shots[idx]}
          className="as-pv-img"
          src={previewUrl(shots[idx]!, wide ? 'd' : 'm')}
          alt={st.previewN(idx + 1, n)}
        />
      </div>
      {n > 1 && (
        <div className="as-pv-ctl">
          <button
            type="button"
            className="as-pv-nav"
            aria-label={st.previewN(idx, n)}
            disabled={idx === 0}
            onClick={() => go(idx - 1)}
          >
            <SkIcon name="back" />
          </button>
          <div className="as-pv-dots" role="group" aria-label={st.previewsLabel}>
            {shots.map((sh, i) => (
              <button
                key={sh}
                type="button"
                className={i === idx ? 'on' : ''}
                aria-label={st.previewN(i + 1, n)}
                aria-current={i === idx}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="as-pv-nav"
            aria-label={st.previewN(idx + 2, n)}
            disabled={idx === n - 1}
            onClick={() => go(idx + 1)}
          >
            <SkIcon name="chev" />
          </button>
        </div>
      )}
    </div>
  );
}
