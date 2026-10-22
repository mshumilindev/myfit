import { useState } from 'react';
import { staticMapThumb } from '../data/gymProviders';
import { useGeoSearchOn } from '../legal/useGeoSearch';
import { HouseGraphic } from './HouseGraphic';

/**
 * Result thumbnail with a graceful fallback chain: real photo/logo (when
 * resolved) → OSM map-tile of the venue → local house graphic. Each level
 * degrades on load error, so a row is never blank. Without the gym-search consent (SPO-293) it is the local graphic:
 * the photo and the tile are both requests to outside services.
 */
export function GymResultThumb({ photo, lat, lng }: { photo?: string; lat: number; lng: number }) {
  const on = useGeoSearchOn();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const map = staticMapThumb(lat, lng);
  const src = !on ? null : photo && !failed.has(photo) ? photo : !failed.has(map) ? map : null;
  if (!src) return <HouseGraphic size={64} />;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed((f) => new Set(f).add(src))} />
  );
}
