/**
 * Push switches (Requests / Reminders / Team): the store lives in `pushPrefsStore.ts` (which `push.ts` reads); saving also
 * sends the switches to the device's push document. Split in two so `push.ts` and this file do not import each other.
 */
import { storePrefs, type PushPrefs } from './pushPrefsStore';

export * from './pushPrefsStore';

export function savePrefs(p: PushPrefs): void {
  const saved = storePrefs(p);
  void import('./push').then((m) => m.syncPrefsToServer(saved)).catch(() => undefined);
}
