/**
 * Gym thumbnail with a self-resolving, graceful fallback chain: real photo /
 * brand logo (keyless, cached) → OSM map tile of the venue → local house
 * graphic. Each level degrades on load error, so a slot is never blank. Used by
 * the gyms list, gym picker, gym detail header, and the live-session hero.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { resolvePhoto, staticMapThumb } from '../data/gymProviders';
import { HouseGraphic } from './HouseGraphic';

/** Bundled with the app (public/gyms): the last step of the chain when `neutral` is set. */
export const NEUTRAL_GYM = '/gyms/neutral-gym.svg';

/** name|lat,lng → resolved photo url, for this page session. */
const RESOLVED = new Map<string, string>();

export function GymThumb({
  name,
  lat,
  lng,
  size = 64,
  eager = false,
  boxed = false,
  neutral = false,
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
  /** Offline-safe fallback (R-KIT-07): when no photo resolves, show the bundled neutral gym picture instead of an
   *  OSM map tile (network) or the house graphic. Default false: the real app is unchanged. */
  neutral?: boolean;
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
  if (unknown && neutral)
    return box(<img className="lighten" src={NEUTRAL_GYM} alt="" loading="lazy" />);
  if (unknown) return box(<HouseGraphic size={size} />);
  const map = neutral ? '' : staticMapThumb(lat, lng);
  const src = photoUrl && !failed.has(photoUrl) ? photoUrl : map && !failed.has(map) ? map : null;
  if (!src && neutral)
    return box(<img className="lighten" src={NEUTRAL_GYM} alt="" loading="lazy" />);
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
