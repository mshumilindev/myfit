import { useEffect, useRef, useState } from 'react';
import { resolvePhoto, type PlaceResult } from '../data/gymProviders';

/** Search results below this rank are far down the list: their photos are looked up when they are needed, not all at once. */
const RESULT_PHOTOS_MAX = 20;
/** Photos resolved in this session by result key (memory only). */
const SESSION_PHOTOS = new Map<string, string>();

/** Photos of the shown gym results, by result key (see the notes on each part below). */
export function useResultPhotos(
  on: boolean,
  nearby: readonly PlaceResult[],
  results: readonly PlaceResult[],
): Record<string, string> {
  // Lazily resolve a real photo/logo per shown result. Rows render at once with the local graphic; a photo replaces it when
  // found. Results stream in (every provider re-renders this list), so a lookup must survive those re-renders: one
  // controller for the life of the screen, aborted only on leaving it. Photos found this session are kept across visits
  // to the screen (memory only: the Google terms do not allow storing their images on the device).
  const [photos, setPhotos] = useState<Record<string, string>>(() =>
    Object.fromEntries(SESSION_PHOTOS),
  );
  const requested = useRef<Set<string>>(new Set());
  const photoCtl = useRef<AbortController | null>(null);
  useEffect(() => {
    photoCtl.current = new AbortController();
    const ctl = photoCtl.current;
    return () => ctl.abort();
  }, []);
  useEffect(() => {
    const ctl = photoCtl.current;
    if (!on || !ctl) return;
    for (const r of [...nearby, ...results.slice(0, RESULT_PHOTOS_MAX)]) {
      if (r.photoUrl || requested.current.has(r.key)) continue;
      requested.current.add(r.key);
      const known = SESSION_PHOTOS.get(r.key);
      if (known) continue;
      resolvePhoto(r, ctl.signal)
        .then((url) => {
          if (!url || ctl.signal.aborted) return;
          SESSION_PHOTOS.set(r.key, url);
          setPhotos((m) => ({ ...m, [r.key]: url }));
        })
        .catch(() => requested.current.delete(r.key));
    }
  }, [nearby, results, on]);
  return photos;
}
