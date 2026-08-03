/**
 * Avatar (AC-AVATAR-07/08): the person's photo when one exists, otherwise
 * initials on a graphite disc — never a broken image, silhouette or empty
 * circle. Auth'd image URLs go through fetch with the bearer token.
 */
import { useEffect, useState } from 'react';
import { getToken } from '../api';

const urlCache = new Map<string, string>();

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const key = userId && hasPhoto ? `${userId}#${refreshKey}` : null;
  // Cached object-URLs resolve synchronously (render-time), fetches via effect.
  const cached = key ? (urlCache.get(key) ?? null) : null;
  const [fetched, setFetched] = useState<string | null>(null);
  const src = cached ?? fetched;

  useEffect(() => {
    if (!key || urlCache.has(key)) return;
    let alive = true;
    fetch(`/api/profile/avatars/${userId}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    })
      .then(async (r) => {
        if (!r.ok) return null;
        const blob = await r.blob();
        return URL.createObjectURL(blob);
      })
      .then((url) => {
        if (url && alive) {
          urlCache.set(key, url);
          setFetched(url);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, key]);

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
