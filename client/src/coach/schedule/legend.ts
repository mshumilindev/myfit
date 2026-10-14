/**
 * The calendar legend as filters: one key per kind of thing the grid draws. Pure (no React); the view state lives in
 * the hash query (`hide=done,missed`), see `useScheduleParams`.
 *
 *   planned     upcoming / pending sessions (and sessions with an open move request)
 *   inprogress  the session running now (derived from the clock, see status.ts)
 *   done      sessions that took place
 *   missed    sessions marked missed
 *   proposed  proposed-move ghosts and the struck "Moved to ..." marks
 *   overlap   the overlap warning (icon, tone and the summary tag); hiding it never hides a session
 */
import { cardStateOf } from './status';
import type { ScheduleSlot } from './types';

export const LEGEND_KEYS = [
  'planned',
  'inprogress',
  'done',
  'missed',
  'proposed',
  'overlap',
] as const;
export type LegendKey = (typeof LEGEND_KEYS)[number];

/**
 * Which legend key a session / ghost belongs to (overlap is a flag, not a category of its own). With `now` a running
 * session is `inprogress`; without it (older callers, tests) it stays `planned`.
 */
export function legendKeyOf(
  s: ScheduleSlot,
  ghost = false,
  now?: number,
): Exclude<LegendKey, 'overlap'> {
  if (now !== undefined) return cardStateOf(s, now, ghost);
  if (ghost || s.status === 'moved') return 'proposed';
  if (s.status === 'done') return 'done';
  if (s.status === 'missed') return 'missed';
  return 'planned';
}

/** `hide` query value -> set of hidden keys; unknown words are ignored. */
export function parseHidden(v: string | null | undefined): ReadonlySet<LegendKey> {
  const out = new Set<LegendKey>();
  for (const w of (v ?? '').split(',')) {
    const k = w.trim() as LegendKey;
    if (LEGEND_KEYS.includes(k)) out.add(k);
  }
  return out;
}

/** Set of hidden keys -> query value (stable order); null when nothing is hidden. */
export function serializeHidden(hidden: ReadonlySet<LegendKey>): string | null {
  const s = LEGEND_KEYS.filter((k) => hidden.has(k)).join(',');
  return s || null;
}

export function toggleHidden(hidden: ReadonlySet<LegendKey>, key: LegendKey): string | null {
  const next = new Set(hidden);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return serializeHidden(next);
}
