/**
 * Sessions (SPO-212), client side: this device's record on the server, the list for Profile → Settings → Sessions, and the
 * watch that signs this device out when it was signed out from another one. Server rules: functions/src/sessions.ts.
 */
import { callFn, renewSessionWithToken } from '../api';
import { sessionDeviceId } from './sessionDevice';

export { sessionDeviceId };

const CHECK_EVERY_MS = 60_000;

export interface SessionRow {
  deviceId: string;
  label: string;
  city: string | null;
  country: string | null;
  lastSeenAt: number;
  createdAt: number;
}

const quiet = { quiet: true } as const;

/** Refreshes this device's record. False = this device was signed out from another one. Any failure counts as still active. */
export async function checkSession(): Promise<boolean> {
  try {
    const r = await callFn<{ active: boolean }>(
      'sessionCheck',
      { deviceId: sessionDeviceId() },
      quiet,
    );
    return r.active !== false;
  } catch {
    return true; // offline or server not updated yet: never sign anyone out on a failed check
  }
}

export async function listSessions(): Promise<SessionRow[]> {
  const r = await callFn<{ sessions: SessionRow[] }>('sessionList', undefined, quiet);
  return r.sessions;
}

export async function revokeSession(deviceId: string): Promise<void> {
  await callFn('sessionRevoke', { deviceId }, quiet);
}

export async function revokeOtherSessions(): Promise<number> {
  const r = await callFn<{ revoked: number; token?: string }>(
    'sessionRevokeOthers',
    { deviceId: sessionDeviceId() },
    quiet,
  );
  // The server ended every refresh token of the account, this device's too: sign it back in right away.
  if (r.token) await renewSessionWithToken(r.token);
  return r.revoked;
}

/** Checks now and again on focus / back online (at most once a minute); `onRevoked` runs once when this device was signed out elsewhere. */
export function watchSession(onRevoked: () => void): () => void {
  let last = 0;
  let stopped = false;
  const run = async (force = false) => {
    const now = Date.now();
    if (stopped || (!force && now - last < CHECK_EVERY_MS)) return;
    last = now;
    if (!(await checkSession()) && !stopped) {
      stopped = true;
      onRevoked();
    }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') void run();
  };
  const onOnline = () => void run();
  void run(true);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}

/** "5 minutes ago" in the app language. */
export function relativeTime(ms: number, locale: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const s = Math.round((ms - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

/** "Warsaw, PL" / "PL" / "" (nothing is invented when the host gave no place). */
export function placeText(r: Pick<SessionRow, 'city' | 'country'>): string {
  const city = r.city ? r.city.replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  return [city, r.country ?? ''].filter(Boolean).join(', ');
}
