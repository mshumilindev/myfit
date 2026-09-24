/**
 * Web push for the installed PWA (Firebase Cloud Messaging, no server of our
 * own). A device that opts in stores its FCM token at users/{uid}/push/{device};
 * Cloud Functions deliver from there (scheduled outbox, exact-time rest alerts).
 *
 * iPhone only allows push inside a Home Screen web app (iOS 16.4+), and the
 * permission prompt must come from a tap — so `enablePush` asks for permission
 * first, before any other await.
 */
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { app, db, functions } from './firebase';
import { currentUid } from './api';
import { isAppleTouch } from './haptics';

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;
const DEVICE_KEY = 'spotter.pushDevice';
const ON_KEY = 'spotter.pushOn';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function hasPushApis(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Where this device stands with push, synchronously (for rendering). */
export function pushState(): PushState {
  if (!VAPID_KEY) return 'unsupported';
  if (isAppleTouch() && !isStandalone()) return 'needs-install';
  if (!hasPushApis()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && localStorage.getItem(ON_KEY) === '1') return 'on';
  return 'off';
}

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function saveToken(locale: string): Promise<boolean> {
  const uid = currentUid();
  if (!uid || !VAPID_KEY || !(await isSupported())) return false;
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return false;
  await setDoc(doc(db, 'users', uid, 'push', deviceId()), {
    token,
    platform: isAppleTouch() ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'web',
    locale,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    updatedAt: Date.now(),
  });
  return true;
}

/** Turn push on for this device. Call straight from a tap handler. */
export async function enablePush(locale: string): Promise<PushState> {
  const state = pushState();
  if (state === 'unsupported' || state === 'needs-install' || state === 'denied') return state;
  // Permission first: iOS drops the prompt once another await has run.
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  try {
    if (!(await saveToken(locale))) return 'off';
  } catch (err) {
    console.error('push: could not register', err);
    return 'off';
  }
  localStorage.setItem(ON_KEY, '1');
  return 'on';
}

/** Keep the token fresh on start (FCM rotates tokens; iOS may drop them). */
export async function refreshPush(locale: string): Promise<void> {
  if (pushState() !== 'on') return;
  try {
    await saveToken(locale);
  } catch (err) {
    console.warn('push: token refresh failed', err);
  }
}

export async function disablePush(): Promise<void> {
  localStorage.removeItem(ON_KEY);
  const uid = currentUid();
  try {
    if (await isSupported()) await deleteToken(getMessaging(app));
  } catch {
    /* the token may already be gone */
  }
  if (uid) await deleteDoc(doc(db, 'users', uid, 'push', deviceId())).catch(() => {});
}

/** Unread count on the Home Screen icon (no-op where unsupported). */
export function setAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) void nav.setAppBadge?.(count).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Exact-time "rest is over" for a locked phone: a server task fires at `dueAt`.
 * `key` is the logged set's id, so a new set or skipping rest cancels it.
 */
export function scheduleRestPush(key: string, dueAt: number, title: string, body: string): void {
  if (pushState() !== 'on') return;
  void httpsCallable(
    functions,
    'scheduleRestPush',
  )({ key, dueAt, title, body }).catch((err) => console.warn('push: rest schedule failed', err));
}

export function cancelRestPush(key: string): void {
  if (pushState() !== 'on') return;
  void httpsCallable(functions, 'cancelRestPush')({ key }).catch(() => {});
}
