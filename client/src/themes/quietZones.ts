/**
 * Places where a theme preview must never run (SPO-355): wherever the person is training, typing or reading.
 * The registry is by route (the same `#/…` strings the app speaks; see route.ts), so a new screen is covered by
 * adding one line here — nothing is hard-coded in the screens. Entering a zone during a preview ends it
 * ("Keep current": the look goes back, nothing is saved, the theme is NOT marked seen, so the invite returns later).
 * The announcement itself only appears on hub surfaces (components/HubSlot.tsx), which are never in a zone.
 */
import { legalRoute } from '../legal/route';

export type QuietReason = 'training' | 'reading' | 'typing';

export interface QuietZone {
  id: string;
  reason: QuietReason;
  /** Matches the route path without `#`, query or trailing slash, e.g. `/session`, `/health/privacy`. */
  match: (path: string) => boolean;
}

const startsWith =
  (...prefixes: string[]) =>
  (p: string) =>
    prefixes.some((x) => p === x || p.startsWith(`${x}/`));

export const QUIET_ZONES: readonly QuietZone[] = [
  // training: a live or logged session, whatever the kind
  { id: 'session', reason: 'training', match: startsWith('/session', '/trainee') },
  { id: 'activity', reason: 'training', match: startsWith('/activity', '/log-activity') },
  { id: 'past-workout', reason: 'training', match: startsWith('/workout') },
  { id: 'builder', reason: 'training', match: startsWith('/builder') },
  { id: 'home-set', reason: 'training', match: startsWith('/home') },
  { id: 'sleep', reason: 'training', match: startsWith('/sleep') },
  { id: 'coach-live', reason: 'training', match: startsWith('/coach/live') },
  // reading: documents, consents, stories
  {
    id: 'legal-documents',
    reason: 'reading',
    match: (p) => legalRoute(`#${p}`) !== null || startsWith('/consents', '/health/privacy')(p),
  },
  { id: 'recap-story', reason: 'reading', match: startsWith('/recap-story') },
  // typing: a chat composer is open
  { id: 'chat', reason: 'typing', match: startsWith('/trainer/chat', '/coach/chat') },
];

/** `#/session/x?y=1`, `/session/x/` or `session` → `/session/x`. */
export function routePath(hash: string): string {
  const raw = hash.replace(/^#/, '').split(/[?#]/)[0];
  const p = raw.startsWith('/') ? raw : `/${raw}`;
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

export function quietZoneAt(hash: string): QuietZone | null {
  const path = routePath(hash);
  return QUIET_ZONES.find((z) => z.match(path)) ?? null;
}
