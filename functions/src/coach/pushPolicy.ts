/**
 * Push policy of the coaching module, pure (no Firebase): the tag of each notice and the quiet-hours check.
 * The client (`client/src/quietHours.ts` CHAT_PUSH_TAG) and the service worker (`public/sw-push.js`) key on the SAME
 * prefix `coach-chat`: a chat push is the only coach push that quiet hours apply to.
 */
export type CoachNoticeKind = 'message' | 'invite' | 'request' | 'program';

/** Prefix of every chat push tag (must equal CHAT_PUSH_TAG in the client). */
export const CHAT_PUSH_TAG = 'coach-chat';

export const pushTag = (kind: CoachNoticeKind): string =>
  kind === 'message' ? CHAT_PUSH_TAG : `coach-${kind}`;

export interface QuietWindow {
  on: boolean;
  from: number;
  to: number;
}

const inMinutes = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1440;

/** The `quiet` object a device stored in its push doc, or null when it is missing or malformed. */
export function parseQuietWindow(v: unknown): QuietWindow | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.on !== 'boolean' || !inMinutes(o.from) || !inMinutes(o.to)) return null;
  return { on: o.on, from: o.from, to: o.to };
}

/** Minutes after local midnight at `at` in the IANA zone `tz` (UTC when the zone is unknown). */
export function localMinutes(at: number, tz: unknown): number {
  let zone: string | undefined;
  if (typeof tz === 'string' && tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      zone = tz;
    } catch {
      zone = undefined;
    }
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone ?? 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Is `at` inside the device's quiet window? The window may wrap midnight; from === to means never. */
export function isQuietNow(quiet: unknown, tz: unknown, at: number): boolean {
  const q = parseQuietWindow(quiet);
  // a device that never stored a setting gets the app default (22:00 to 07:00, on), like the client
  const w = q ?? { on: true, from: 22 * 60, to: 7 * 60 };
  if (!w.on || w.from === w.to) return false;
  const m = localMinutes(at, tz);
  return w.from < w.to ? m >= w.from && m < w.to : m >= w.from || m < w.to;
}
