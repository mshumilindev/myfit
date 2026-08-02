/**
 * Gym thumbnail with a self-resolving, graceful fallback chain: real photo /
 * brand logo (keyless, cached) → OSM map tile of the venue → local house
 * graphic. Each level degrades on load error, so a slot is never blank. Used by
 * the gyms list, gym picker, gym detail header, and the live-session hero.
 */
import { useEffect, useState } from 'react';
import { resolvePhoto, staticMapThumb } from '../data/gymProviders';
import { HouseGraphic } from './HouseGraphic';

export function GymThumb({
  name,
  lat,
  lng,
  size = 64,
}: {
  name: string;
  lat: number;
  lng: number;
  size?: number;
}) {
  const [photo, setPhoto] = useState<string | undefined>();
  const [failed, setFailed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const sig = new AbortController().signal;
    resolvePhoto({ key: `${lat},${lng}`, name, lat, lng, sources: ['local'] }, sig)
      .then((url) => {
        if (url && alive) setPhoto(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name, lat, lng]);

  const map = staticMapThumb(lat, lng);
  const src = photo && !failed.has(photo) ? photo : !failed.has(map) ? map : null;
  if (!src) return <HouseGraphic size={size} />;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed((f) => new Set(f).add(src))} />
  );
}
