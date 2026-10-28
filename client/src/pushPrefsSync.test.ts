import { beforeEach, describe, expect, it, vi } from 'vitest';

// SPO-386 (T3): the push switches live in the account (`meta/prefs.pushPrefs`), so they survive sign-out and follow the person.
const sent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('./push', () => ({ syncPrefsToServer: sent }));

import { loadPrefs, resetPrefsForTests, storePrefs } from './pushPrefsStore';
import { PUSH_PREFS_FIELD, pushPushPrefsEdits, syncPushPrefsFromDoc } from './pushPrefsSync';

const ALL_ON = { requests: true, reminders: true, team: true };
const off = { requests: false, reminders: true, team: false };
beforeEach(() => {
  localStorage.clear();
  resetPrefsForTests();
  sent.mockClear();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('syncing the push switches with the account', () => {
  it('account has no value and the device is on defaults: nothing is written', () => {
    const write = vi.fn();
    syncPushPrefsFromDoc({}, write);
    expect(write).not.toHaveBeenCalled();
  });
  it('account has no value but this device already switched something off: it is saved to the account once', () => {
    storePrefs(off);
    const write = vi.fn();
    syncPushPrefsFromDoc({}, write);
    expect(write).toHaveBeenCalledWith({ [PUSH_PREFS_FIELD]: off });
  });
  it('after sign-out wiped the device, signing in again brings the switches back', async () => {
    storePrefs(off);
    localStorage.clear(); // what sign-out does to every key that is not a device key
    resetPrefsForTests();
    const write = vi.fn();
    syncPushPrefsFromDoc({ [PUSH_PREFS_FIELD]: off }, write);
    expect(loadPrefs()).toEqual(off);
    expect(write).not.toHaveBeenCalled(); // taken from the account: no echo back
    await tick();
    expect(sent).toHaveBeenCalledWith(off); // and this device's push document gets them too
  });
  it('a change made on another device is applied without being written back', () => {
    const write = vi.fn();
    pushPushPrefsEdits(write);
    syncPushPrefsFromDoc({ [PUSH_PREFS_FIELD]: off }, write);
    expect(loadPrefs()).toEqual(off);
    expect(write).not.toHaveBeenCalled();
  });
  it('the same value changes nothing (no extra server call)', async () => {
    storePrefs(ALL_ON);
    syncPushPrefsFromDoc({ [PUSH_PREFS_FIELD]: ALL_ON }, vi.fn());
    await tick();
    expect(sent).not.toHaveBeenCalled();
  });
  it('a damaged account value falls back to the safe reading (only a literal false switches a kind off)', () => {
    syncPushPrefsFromDoc({ [PUSH_PREFS_FIELD]: { requests: 'no', team: false } }, vi.fn());
    expect(loadPrefs()).toEqual({ requests: true, reminders: true, team: false });
  });
  it('a switch the person flips on this device is written to the account', () => {
    const write = vi.fn();
    pushPushPrefsEdits(write);
    storePrefs(off);
    expect(write).toHaveBeenCalledWith({ [PUSH_PREFS_FIELD]: off });
  });
  it('first contact: a switch off on this device stays off even if the account says on, and the merge is written back', () => {
    storePrefs({ requests: true, reminders: false, team: true });
    const write = vi.fn();
    syncPushPrefsFromDoc(
      { [PUSH_PREFS_FIELD]: { requests: true, reminders: true, team: false } },
      write,
    );
    expect(loadPrefs()).toEqual({ requests: true, reminders: false, team: false });
    expect(write).toHaveBeenCalledWith({
      [PUSH_PREFS_FIELD]: { requests: true, reminders: false, team: false },
    });
  });
  it('after the first contact the account wins again, so a switch can be turned back on from another device', () => {
    storePrefs({ requests: true, reminders: false, team: true });
    syncPushPrefsFromDoc(
      { [PUSH_PREFS_FIELD]: { requests: true, reminders: false, team: true } },
      vi.fn(),
    );
    const write = vi.fn();
    syncPushPrefsFromDoc({ [PUSH_PREFS_FIELD]: ALL_ON }, write);
    expect(loadPrefs()).toEqual(ALL_ON);
    expect(write).not.toHaveBeenCalled();
  });
});
