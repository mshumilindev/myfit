/**
 * Avatar (AC-AVATAR-07/08): the person's photo when one exists, otherwise
 * initials on a graphite disc — never a broken image, silhouette or empty
 * circle. The photo is fetched from Cloud Storage via getBlob, which downloads
 * over an authenticated request so storage.rules (owner/admin/assigned-trainer)
 * are enforced — unlike a tokenized download URL.
 */
import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from '../firebase';

const urlCache = new Map<string, string>();

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Drop cached object-URLs for a user (all refresh generations). */
export function invalidateAvatarCache(userId: string): void {
  for (const [key, url] of urlCache) {
    if (key === userId || key.startsWith(`${userId}#`)) {
      URL.revokeObjectURL(url);
      urlCache.delete(key);
    }
  }
}

/** Seed cache so the next Avatar mount paints immediately after upload. */
export function seedAvatarCache(userId: string, objectUrl: string, refreshKey = 0): void {
  invalidateAvatarCache(userId);
  urlCache.set(`${userId}#${refreshKey}`, objectUrl);
}

export function Avatar({
  userId,
  name,
  hasPhoto = false,
  size = 34,
  refreshKey = 0,
}: {
  userId?: string;
  name: string;
  hasPhoto?: boolean;
  size?: number;
  refreshKey?: number;
}) {
  // Never use the literal "me" — Storage paths are avatars/{uid}/photo.
  const uid = userId && userId !== 'me' ? userId : undefined;
  const cacheKey = uid && hasPhoto ? `${uid}#${refreshKey}` : null;

  return (
    <AvatarFace
      key={cacheKey ?? `initials-${name}-${size}`}
      uid={uid}
      cacheKey={cacheKey}
      name={name}
      size={size}
    />
  );
}

function AvatarFace({
  uid,
  cacheKey,
  name,
  size,
}: {
  uid?: string;
  cacheKey: string | null;
  name: string;
  size: number;
}) {
  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? (urlCache.get(cacheKey) ?? null) : null,
  );

  useEffect(() => {
    if (!cacheKey || !uid || urlCache.has(cacheKey)) return;
    let alive = true;
    getBlob(ref(storage, `avatars/${uid}/photo`))
      .then((blob) => {
        if (!blob || blob.size === 0) return null;
        return URL.createObjectURL(blob);
      })
      .then((url) => {
        if (!alive) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          urlCache.set(cacheKey, url);
          setSrc(url);
        }
      })
      .catch((err) => {
        console.warn('[avatar] getBlob failed', uid, err);
      });
    return () => {
      alive = false;
    };
  }, [uid, cacheKey]);

  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src) {
    return <img className="avatar lighten" style={style} src={src} alt="" />;
  }
  return (
    <span className="avatar initials" style={style} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
