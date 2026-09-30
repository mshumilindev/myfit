/**
 * Gym thumbnail with a self-resolving, graceful fallback chain: real photo /
 * brand logo (keyless, cached) → OSM map tile of the venue → local house
 * graphic. Each level degrades on load error, so a slot is never blank. Used by
 * the gyms list, gym picker, gym detail header, and the live-session hero.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { resolvePhoto, staticMapThumb } from '../data/gymProviders';
import { HouseGraphic } from './HouseGraphic';

/** name|lat,lng → resolved photo url, for this page session. */
const RESOLVED = new Map<string, string>();

export function GymThumb({
  name,
  lat,
  lng,
  size = 64,
  eager = false,
  boxed = false,
}: {
  name: string;
  lat: number;
  lng: number;
  size?: number;
  /** Heroes: load now at high priority. Lazy loading waits for layout/scroll
   *  and made the history-details hero photo appear seconds late. */
  eager?: boolean;
  /** Render inside its own size×size rounded box (list-row icons); otherwise the
   *  parent's CSS sizes the image (heroes, cards). */
  boxed?: boolean;
}) {
  const key = `${name}|${lat},${lng}`;
  // Resolved photos are remembered for the session, so a gym seen once (a live
  // hero, the gyms list) shows instantly in the next hero instead of waiting
  // for the lookup chain again.
  const [photo, setPhoto] = useState<{ key: string; url: string } | undefined>(() => {
    const url = RESOLVED.get(key);
    return url ? { key, url } : undefined;
  });
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const unknown = !name && lat === 0 && lng === 0;

  useEffect(() => {
    // Gym not known yet (its record still loading): nothing to look up.
    if (unknown || RESOLVED.has(key)) return;
    let alive = true;
    const sig = new AbortController().signal;
    resolvePhoto({ key: `${lat},${lng}`, name, lat, lng, sources: ['local'] }, sig)
      .then((url) => {
        if (!url) return;
        RESOLVED.set(key, url);
        if (alive) setPhoto({ key, url });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, name, lat, lng, unknown]);

  const cached = RESOLVED.get(key);
  const photoUrl = photo?.key === key ? photo.url : cached;

  const box = (node: ReactNode) =>
    boxed ? (
      <span className="gymthumb" style={{ width: size, height: size }}>
        {node}
      </span>
    ) : (
      node
    );
  if (unknown) return box(<HouseGraphic size={size} />);
  const map = staticMapThumb(lat, lng);
  const src = photoUrl && !failed.has(photoUrl) ? photoUrl : !failed.has(map) ? map : null;
  if (!src) return box(<HouseGraphic size={size} />);
  return box(
    <img
      className="lighten"
      src={src}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      {...(eager ? { fetchPriority: 'high' as const } : {})}
      onError={() => setFailed((f) => new Set(f).add(src))}
    />,
  );
}
