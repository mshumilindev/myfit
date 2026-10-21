/**
 * Push policy of the coaching module, pure (no Firebase): the tag of each notice and the quiet-hours check.
 * The client (`client/src/quietHours.ts` CHAT_PUSH_TAG) and the service worker (`public/sw-push.js`) key on the SAME
 * prefix `coach-chat`: a chat push is the only coach push that quiet hours apply to.
 */
export type CoachNoticeKind =
  'message' | 'invite' | 'request' | 'program' | 'team' | 'reminder' | 'sync';

/** The notification categories a person can switch (boards C6 / U1-U3); `sync` is silent and has no switch. */
export type PushCategory = 'chat' | 'requests' | 'team' | 'reminders';
export const categoryOf = (kind: CoachNoticeKind): PushCategory | null =>
  kind === 'message'
    ? 'chat'
    : kind === 'team'
      ? 'team'
      : kind === 'reminder'
        ? 'reminders'
        : kind === 'sync'
          ? null
          : 'requests';

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

const formatters = new Map<string, Intl.DateTimeFormat | null>();
/** One formatter per zone (building one is slow); null for a zone name the platform does not know. */
function zoneFormatter(tz: unknown): Intl.DateTimeFormat {
  const key = typeof tz === 'string' && tz ? tz : 'UTC';
  let f = formatters.get(key);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-GB', {
        timeZone: key,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
    } catch {
      f = null;
    }
    formatters.set(key, f);
  }
  return f ?? zoneFormatter('UTC');
}

/** Minutes after local midnight at `at` in the IANA zone `tz` (UTC when the zone is unknown). */
export function localMinutes(at: number, tz: unknown): number {
  const parts = zoneFormatter(tz).formatToParts(new Date(at));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Local calendar date (YYYY-MM-DD) at `at` in the IANA zone `tz` (UTC when the zone is unknown). */
export function localDate(at: number, tz: unknown): string {
  let zone = 'UTC';
  if (typeof tz === 'string' && tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      zone = tz;
    } catch {
      /* unknown zone: UTC */
    }
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at));
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

/** Per-device switches stored in the push doc next to `quiet` (`prefs`). A missing or malformed value means ON. */
export interface PushPrefs {
  requests: boolean;
  reminders: boolean;
  team: boolean;
}
export function parsePushPrefs(v: unknown): PushPrefs {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const on = (k: string) => o[k] !== false;
  return { requests: on('requests'), reminders: on('reminders'), team: on('team') };
}

/**
 * Does this notice reach this device as a push? (The Spotter entry is written either way; only the push is held.)
 *  - chat: held inside the device's quiet window (unchanged);
 *  - reminders: off when switched off, held inside the quiet window;
 *  - requests and team: off only when switched off; quiet hours never hold them (a request with an action must arrive);
 *  - sync: silent data push, always.
 */
export function shouldDeliver(
  kind: CoachNoticeKind,
  device: { quiet?: unknown; tz?: unknown; prefs?: unknown },
  at: number,
): boolean {
  const cat = categoryOf(kind);
  if (cat === null) return true;
  if (cat === 'chat') return !isQuietNow(device.quiet, device.tz, at);
  const prefs = parsePushPrefs(device.prefs);
  if (cat === 'reminders') return prefs.reminders && !isQuietNow(device.quiet, device.tz, at);
  return prefs[cat];
}
