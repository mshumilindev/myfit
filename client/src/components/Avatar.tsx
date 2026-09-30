/**
 * Avatar (AC-AVATAR-07/08): the person's photo when one exists, otherwise
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

/** Seed cache so the next Avatar mount paints immediately after upload. */
export function seedAvatarCache(userId: string, objectUrl: string, refreshKey = 0, rev = 0): void {
  invalidateAvatarCache(userId);
  urlCache.set(`${userId}#${refreshKey}#${rev}`, objectUrl);
}

export function Avatar({
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

    // 1) Persisted blob (survives reloads); served only when its rev matches.
    readAvatarBlob(uid, rev)
      .then((cachedBlob) => {
        if (!alive) return;
        if (cachedBlob && cachedBlob.size > 0) {
          adopt(cachedBlob);
          return;
        }
        // 2) Miss (or rev changed) → download once, then persist for next time.
        getBlob(ref(storage, `avatars/${uid}/photo`))
          .then((blob) => {
            if (!alive || !blob || blob.size === 0) return;
            writeAvatarBlob(uid, rev, blob);
            adopt(blob);
          })
          .catch((err) => {
            console.warn('[avatar] getBlob failed', uid, err);
          });
      })
      .catch(() => {
        /* best-effort — falls through to initials */
      });

    return () => {
      alive = false;
    };
  }, [uid, cacheKey, rev]);

  // The disc itself is the kit primitive; this component only finds the photo.
  return <AvatarDisc src={src} name={name} size={size} className="avatar" aria-hidden />;
}
