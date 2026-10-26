import { useState } from 'react';
import { Icon } from '../ui';
import './PickPhoto.css';

/** The glyph a start card shows when it has no picture (missing, empty or failed to load). */
export function pickPhotoGlyph(kind: string): string {
  switch (kind) {
    case 'warmup':
      return 'flame';
    case 'cooldown':
      return 'wind';
    case 'cardio':
      return 'heartbeat';
    case 'home':
      return 'house';
    default:
      return 'barbell';
  }
}

/**
 * Picture of a session-start card (warm-up, cool-down, cardio, home, lift). A broken `<img alt="">` paints
 * nothing, which left the card an empty dark box (SPO-358): a missing, empty or failing `src` renders the
 * type glyph on a tinted gradient instead, so a card is never blank. `fallbackClassName` keeps the
 * layout class the host already positions (`es-hero-noimg`, `es-noimg`, `tb-noimg`, `pbs-noimg`).
 */
export function PickPhoto({
  src,
  kind,
  fallbackClassName,
}: {
  src?: string | null;
  kind: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src)
    return (
      <span
        className={['pickphoto-fallback', `pickphoto-fallback--${kind}`, fallbackClassName]
          .filter(Boolean)
          .join(' ')}
      >
        <Icon name={pickPhotoGlyph(kind)} />
      </span>
    );
  return <img src={src} alt="" onError={() => setFailed(src)} />;
}
