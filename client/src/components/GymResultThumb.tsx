import { useState } from 'react';
import { useGeoSearchOn } from '../legal/useGeoSearch';
import { HouseGraphic } from './HouseGraphic';

/**
 * Result thumbnail with a graceful fallback chain: real photo/logo (when resolved) → local house graphic. Never a map
 * tile (SPO-340). The graphic also covers a photo that fails to load, so a row is never blank. Without the gym-search
 * consent (SPO-293) it is the local graphic: the photo is a request to an outside service.
 */
export function GymResultThumb({ photo }: { photo?: string }) {
  const on = useGeoSearchOn();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const src = on && photo && !failed.has(photo) ? photo : null;
  if (!src) return <HouseGraphic size={64} />;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed((f) => new Set(f).add(src))} />
  );
}
