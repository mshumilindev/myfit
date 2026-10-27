/**
 * UserAvatar (AC-AVATAR-07/08): the person's photo when one exists, otherwise
 * initials on a graphite disc — never a broken image, silhouette or empty
 * circle. The photo is fetched from Cloud Storage via getBlob, which downloads
 * over an authenticated request so storage.rules (owner/admin/assigned-trainer)
 * are enforced — unlike a tokenized download URL.
 *
 * Two cache layers keep photos cheap: an in-memory object-URL map for instant
 * repaints within a page, and a persistent IndexedDB blob store (avatarStore)
 * so a photo survives reloads and is only re-downloaded when its server
 * revision (`rev`) actually changes — a delta check for clients' photos and
 * your own alike.
 */
import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from '../firebase';
import { deleteAvatarBlob, readAvatarBlob, writeAvatarBlob } from '../avatarStore';
import { Avatar as AvatarDisc, initialsOf } from './ui/Avatar';

export { initialsOf };

const urlCache = new Map<string, string>();

const DOWNLOAD_PAUSES_MS = [800, 2500, 7000];
const MAX_PARALLEL = 4;
let running = 0;
const waiting: Array<() => void> = [];

async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((res) => waiting.push(res));
  running += 1;
  try {
    return await job();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

/** One photo from Storage, a few at a time, retried with growing pauses while the caller still wants it. */
async function downloadAvatar(uid: string, wanted: () => boolean): Promise<Blob | null> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await slot(() => getBlob(ref(storage, `avatars/${uid}/photo`)));
    } catch (err) {
      const pause = DOWNLOAD_PAUSES_MS[attempt];
      if (pause === undefined || !wanted()) {
        // Only the error code: a Storage message names the object path, which holds the person's id.
        console.warn('[avatar] getBlob failed', (err as { code?: string } | null)?.code ?? 'error');
        return null;
      }
      await new Promise((res) => setTimeout(res, pause));
      if (!wanted()) return null;
    }
  }
}

/** Drop cached object-URLs (all generations) and the persisted blob for a user. */
export function invalidateAvatarCache(userId: string): void {
  for (const [key, url] of urlCache) {
    if (key === userId || key.startsWith(`${userId}#`)) {
      URL.revokeObjectURL(url);
      urlCache.delete(key);
    }
  }
  deleteAvatarBlob(userId);
}

/** Seed cache so the next UserAvatar mount paints immediately after upload. */
export function seedAvatarCache(userId: string, objectUrl: string, refreshKey = 0, rev = 0): void {
  invalidateAvatarCache(userId);
  urlCache.set(`${userId}#${refreshKey}#${rev}`, objectUrl);
}

export function UserAvatar({
  userId,
  name,
  hasPhoto = false,
  size = 34,
  refreshKey = 0,
  rev = 0,
}: {
  userId?: string;
  name: string;
  hasPhoto?: boolean;
  size?: number;
  refreshKey?: number;
  /** Server-side avatar revision; a change refetches, matching the same rev
   *  serves the persisted blob without touching the network. */
  rev?: number;
}) {
  // Never use the literal "me" — Storage paths are avatars/{uid}/photo.
  const uid = userId && userId !== 'me' ? userId : undefined;
  const cacheKey = uid && hasPhoto ? `${uid}#${refreshKey}#${rev}` : null;

  return (
    <AvatarFace
      key={cacheKey ?? `initials-${name}-${size}`}
      uid={uid}
      cacheKey={cacheKey}
      rev={rev}
      name={name}
      size={size}
    />
  );
}

function AvatarFace({
  uid,
  cacheKey,
  rev,
  name,
  size,
}: {
  uid?: string;
  cacheKey: string | null;
  rev: number;
  name: string;
  size: number;
}) {
  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? (urlCache.get(cacheKey) ?? null) : null,
  );

  useEffect(() => {
    if (!cacheKey || !uid || urlCache.has(cacheKey)) return;
    let alive = true;

    const adopt = (blob: Blob): void => {
      const url = URL.createObjectURL(blob);
      if (!alive) {
        URL.revokeObjectURL(url);
        return;
      }
      urlCache.set(cacheKey, url);
      setSrc(url);
    };

    const swap = (blob: Blob): void => {
      const old = urlCache.get(cacheKey);
      adopt(blob);
      // The stale copy shown meanwhile is replaced by the fresh one: release its object URL.
      if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
    };

    // 1) The copy kept on the device for this revision: paint it and stop (no network).
    // 2) Otherwise a copy of an OLDER revision (or one saved before the revision was known) still paints at once — a
    //    face that is slightly stale beats initials, and beats nothing offline — while the fresh one is fetched.
    // 3) The fetch retries a few times with a pause (a roster of faces opens in a burst and the odd request fails), a
    //    few at a time, and only a success replaces what is shown; a failure leaves the old face or the initials.
    void (async () => {
      try {
        const fresh = await readAvatarBlob(uid, rev);
        if (!alive) return;
        if (fresh && fresh.size > 0) {
          adopt(fresh);
          return;
        }
        const stale = await readAvatarBlob(uid);
        if (!alive) return;
        if (stale && stale.size > 0) adopt(stale);
        const blob = await downloadAvatar(uid, () => alive);
        if (!alive || !blob || blob.size === 0) return;
        writeAvatarBlob(uid, rev, blob);
        swap(blob);
      } catch {
        /* best-effort — the initials (or the stale face) stay */
      }
    })();

    return () => {
      alive = false;
    };
  }, [uid, cacheKey, rev]);

  // The disc itself is the kit primitive; this component only finds the photo.
  return <AvatarDisc src={src} name={name} size={size} className="avatar" aria-hidden />;
}
