/**
 * Where a note sits in the chat thread. Notes are recomputed from history and
 * carry the time of the fact they describe (a set, a session, a day). Usually
 * that's also when Atlas "said" it — but a fact can be learned late (a session
 * synced from another device, a day fact computed on the next open). Placing
 * such a note at its fact time would slip it ABOVE messages you already
 * exchanged, so it goes where it first appeared instead.
 */

const KEY = 'spotter.atlasNoteSeen';
/** Forget first-seen marks older than this (the feed only reaches 14 days back). */
const KEEP_MS = 30 * 86_400_000;

export type SeenMap = Record<string, number>;

export function loadSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === 'object' ? (v as SeenMap) : {};
  } catch {
    return {};
  }
}

export function saveSeen(m: SeenMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable — placement falls back to fact time */
  }
}

/** Record first sight of each note id; drop old marks. Returns the new map (same object if unchanged). */
export function markSeen(m: SeenMap, ids: string[], now: number): SeenMap {
  let next: SeenMap | null = null;
  for (const id of ids)
    if (m[id] === undefined) {
      next ??= { ...m };
      next[id] = now;
    }
  for (const [id, at] of Object.entries(next ?? m))
    if (now - at > KEEP_MS) {
      next ??= { ...m };
      delete next[id];
    }
  return next ?? m;
}

let cache: SeenMap | null = null;

/**
 * First-seen time per note, recorded on this device as notes show up. The
 * very first run seeds every existing note with its own fact time, so the
 * current thread keeps its order. Idempotent: safe to call while rendering.
 */
export function seenFor(notes: { id: string; at: number }[], now: number): SeenMap {
  if (!cache) {
    const stored = loadSeen();
    const fresh = Object.keys(stored).length === 0;
    cache = fresh ? Object.fromEntries(notes.map((n) => [n.id, n.at])) : stored;
    if (fresh) saveSeen(cache);
  }
  const next = markSeen(
    cache,
    notes.map((n) => n.id),
    now,
  );
  if (next !== cache) {
    cache = next;
    saveSeen(cache);
  }
  return cache;
}

/** Tests only. */
export function resetSeenCache(): void {
  cache = null;
}

/**
 * Display time of a note: its fact time, unless a chat message was sent
 * after that fact but before the note first appeared — then the moment it
 * appeared (so it lands below what was already there).
 */
export function placeNote(
  factAt: number,
  firstSeen: number | undefined,
  chatAts: number[],
): number {
  if (firstSeen === undefined || firstSeen <= factAt) return factAt;
  const jumped = chatAts.some((at) => at > factAt && at < firstSeen);
  return jumped ? firstSeen : factAt;
}
