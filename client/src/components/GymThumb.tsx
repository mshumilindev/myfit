/**
 * Gym thumbnail with a self-resolving, graceful fallback chain: real photo /
 * brand logo (Wikimedia, keyless, cached, credited where the licence asks) →
 * local house graphic. Never a map tile (SPO-340): a map is not a picture of the
 * gym and every tile is a request that reveals the position. Each level degrades
 * on load error, so a slot is never blank. Used by the gyms list, gym picker,
 * gym detail header, and the live-session hero.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { resolvePhotoInfo, type GymPhoto } from '../data/gymProviders';
import { useT } from '../i18n';
import { useGeoSearchOn } from '../legal/useGeoSearch';
import { HouseGraphic } from './HouseGraphic';

/** Bundled with the app (public/gyms): the last step of the chain when `neutral` is set. */
export const NEUTRAL_GYM = '/gyms/neutral-gym.svg';

/** name|lat,lng → resolved photo (url + credit), for this page session. */
const RESOLVED = new Map<string, GymPhoto>();

/** Test hook: forget the session's resolved photos. */
export function resetGymThumbCacheForTests(): void {
  RESOLVED.clear();
}

/** "Photo: Author · CC BY-SA 4.0", linking to the image page on Commons; null when the licence asks for nothing. */
function PhotoCredit({ photo, label }: { photo: GymPhoto; label: string }) {
  const c = photo.credit;
  if (!c) return null;
  const text = [c.author, c.license].filter(Boolean).join(' · ') || 'Wikimedia Commons';
  return (
    <span className="gym-photo-credit">
      {label}:{' '}
      {c.pageUrl ? (
        <a href={c.pageUrl} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ) : (
        text
      )}
    </span>
  );
}

export function GymThumb({
  name,
  lat,
  lng,
  size = 64,
  eager = false,
  boxed = false,
  neutral = false,
  credit = false,
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
  /** Heroes: print the photo's credit (author, licence) over the picture, as Commons licences require. */
  credit?: boolean;
}) {
  const { t } = useT();
  const key = `${name}|${lat},${lng}`;
  // Resolved photos are remembered for the session, so a gym seen once (a live
  // hero, the gyms list) shows instantly in the next hero instead of waiting
  // for the lookup chain again.
  const [photo, setPhoto] = useState<{ key: string; photo: GymPhoto } | undefined>(() => {
    const photo = RESOLVED.get(key);
    return photo ? { key, photo } : undefined;
  });
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const unknown = !name && lat === 0 && lng === 0;
  // Photos, logos and map tiles all come from outside services: without the gym-search consent (SPO-293) the thumbnail is
  // the local graphic and nothing is requested.
  const geoOn = useGeoSearchOn();

  useEffect(() => {
    // Gym not known yet (its record still loading): nothing to look up.
    if (!geoOn || unknown || RESOLVED.has(key)) return;
    let alive = true;
    const sig = new AbortController().signal;
    resolvePhotoInfo({ key: `${lat},${lng}`, name, lat, lng, sources: ['local'] }, sig)
      .then((found) => {
        if (!found) return;
        RESOLVED.set(key, found);
        if (alive) setPhoto({ key, photo: found });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, name, lat, lng, unknown, geoOn]);

  const cached = geoOn ? RESOLVED.get(key) : undefined;
  const found = geoOn ? (photo?.key === key ? photo.photo : cached) : undefined;

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
  const src = found && !failed.has(found.url) ? found.url : null;
  if (!src && neutral)
    return box(<img className="lighten" src={NEUTRAL_GYM} alt="" loading="lazy" />);
  if (!src || !found) return box(<HouseGraphic size={size} />);
  return box(
    <>
      <img
        className="lighten"
        src={src}
        alt={t.gymPhotoAlt(name)}
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        {...(eager ? { fetchPriority: 'high' as const } : {})}
        onError={() => setFailed((f) => new Set(f).add(src))}
      />
      {credit ? <PhotoCredit photo={found} label={t.gymPhotoCredit} /> : null}
    </>,
  );
}
