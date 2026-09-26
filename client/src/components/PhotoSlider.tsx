/**
 * Full-screen photo slider — an exercise's frames (start → end of the movement)
 * swiped horizontally with scroll-snap. Opened from the session's exercise
 * photo strip; tap the scrim or ✕ to close, arrows / keys to step.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { Icon } from '../ui';

export function PhotoSlider({
  images,
  title,
  start = 0,
  onClose,
}: {
  images: string[];
  title: string;
  start?: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const track = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(start);

  useEffect(() => {
    const el = track.current;
    if (el) el.scrollTo({ left: start * el.clientWidth, behavior: 'instant' as ScrollBehavior });
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }

  const label = (i: number) =>
    images.length === 2 ? (i === 0 ? t.photoStart : t.photoEnd) : `${i + 1} / ${images.length}`;

  return createPortal(
    <div className="photo-slider" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ps-scrim" onClick={onClose} aria-label={t.srClose} />
      <div className="ps-top">
        <span className="ps-title">{title}</span>
        <button type="button" className="ps-close" onClick={onClose} aria-label={t.srClose}>
          <Icon name="x" weight="bold" />
        </button>
      </div>
      <div
        className="ps-track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {images.map((src, i) => (
          <div className="ps-slide" key={src + i}>
            <img src={src} alt={label(i)} draggable={false} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="ps-bottom">
          <button
            type="button"
            className="ps-arrow"
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            aria-label={t.previousAction}
          >
            <Icon name="caret-left" weight="bold" />
          </button>
          <div className="ps-steps">
            {images.map((_, i) => (
              <button
                type="button"
                key={i}
                className={`ps-step${i === idx ? ' on' : ''}`}
                onClick={() => go(i)}
              >
                {label(i)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ps-arrow"
            onClick={() => go(idx + 1)}
            disabled={idx === images.length - 1}
            aria-label={t.nextAction}
          >
            <Icon name="caret-right" weight="bold" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
