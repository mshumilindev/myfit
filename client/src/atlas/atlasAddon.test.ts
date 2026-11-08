import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '../legal/consents';

const sent = vi.hoisted(() => [] as unknown[]);
const marked = vi.hoisted(() => [] as string[]);
const snapshot = vi.hoisted(() => ({ records: [] as unknown[], fromCache: false }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));
vi.mock('../legal/localOff', async (orig) => ({
  ...(await orig<typeof import('../legal/localOff')>()),
  markLocalOff: (_u: string, k: string) => void marked.push(k),
}));
vi.mock('../legal/signupConsents', async (orig) => ({
  ...(await orig<typeof import('../legal/signupConsents')>()),
  sendConsentDurably: async (i: unknown) => (sent.push(i), true),
}));
vi.mock('../legal/consentApi', async (orig) => ({
  ...(await orig<typeof import('../legal/consentApi')>()),
  subscribeConsentRecords: (_u: string, on: (r: unknown[], m: { fromCache: boolean }) => void) => {
    queueMicrotask(() => on(snapshot.records, { fromCache: snapshot.fromCache }));
    return () => undefined;
  },
}));

import { effectiveAiState, resetAiOverride, setAtlasInstalled } from './aiConsent';
import {
  reconcileAtlasConsent,
  reconcileAtlasConsentAfter,
  watchAtlasRemoval,
} from './withdrawOnRemove';
import { addonsPref, disableAddons, enableAddons } from '../addons/enabledSet';

const rec = (kind: string): ConsentRecord =>
  ({ id: kind, kind, action: 'grant', version: '2099-01-01', at: 1 }) as unknown as ConsentRecord;

beforeEach(() => {
  sent.length = 0;
  marked.length = 0;
  snapshot.records = [];
  snapshot.fromCache = false;
  addonsPref.reset();
  resetAiOverride(false);
});
afterEach(() => setAtlasInstalled(true));

describe('Atlas add-on: AI fails closed (SPO-518)', () => {
  it('without the add-on the AI state is off whatever the override says', () => {
    setAtlasInstalled(false);
    expect(effectiveAiState([], { gemini: true, puter: true })).toEqual({
      gemini: false,
      puter: false,
    });
  });
  it('with the add-on the override is honoured as before', () => {
    expect(effectiveAiState([], { gemini: true })).toEqual({ gemini: true, puter: false });
  });
});

describe('removing the Atlas add-on', () => {
  it('stops AI on this device at once and queues a withdrawal for BOTH consents without reading any cache', async () => {
    snapshot.records = []; // a cold or stale cache must not decide anything
    enableAddons(['atlas'], 'member');
    const off = watchAtlasRemoval();
    disableAddons(['atlas'], 'member');
    off();
    expect(marked.sort()).toEqual(['atlas-ai', 'atlas-puter']);
    expect(sent).toHaveLength(2);
    expect(sent.every((i) => (i as { action: string }).action === 'withdraw')).toBe(true);
  });
  it('also when the add-on leaves through a synced change, not the Remove button', () => {
    enableAddons(['atlas', 'sleep'], 'member');
    const off = watchAtlasRemoval();
    addonsPref.set(['sleep']);
    off();
    expect(sent).toHaveLength(2);
  });
  it('removing something else leaves the AI consents alone', () => {
    enableAddons(['atlas', 'sleep'], 'member');
    const off = watchAtlasRemoval();
    disableAddons(['sleep'], 'member');
    off();
    expect(marked).toEqual([]);
    expect(sent).toEqual([]);
  });
  it('removing an add-on that was never installed does nothing', () => {
    const off = watchAtlasRemoval();
    disableAddons(['atlas'], 'member');
    off();
    expect(marked).toEqual([]);
  });
});

describe('an account that holds AI consent without the add-on', () => {
  it('is withdrawn once the server answered, not on a cache-only snapshot', async () => {
    snapshot.records = [rec('atlas-ai')];
    snapshot.fromCache = true;
    const off = reconcileAtlasConsent();
    await Promise.resolve();
    expect(sent).toEqual([]);
    off();
    snapshot.fromCache = false;
    const off2 = reconcileAtlasConsent();
    await Promise.resolve();
    off2();
    expect(sent).toHaveLength(2);
  });
  it('does nothing when the add-on is installed, or when the answer arrives after a reinstall', async () => {
    snapshot.records = [rec('atlas-ai')];
    enableAddons(['atlas'], 'member');
    reconcileAtlasConsent();
    await Promise.resolve();
    expect(sent).toEqual([]);
    addonsPref.reset();
    const off = reconcileAtlasConsent();
    enableAddons(['atlas'], 'member'); // reinstalled before the answer came
    await Promise.resolve();
    off();
    expect(sent).toEqual([]);
  });
});

describe('a new device whose add-on list has not arrived yet', () => {
  it('does not withdraw the AI consent before the list is known, and not at all once Atlas turns out installed', async () => {
    snapshot.records = [rec('atlas-ai')]; // the server's consent answer comes first
    let ready: () => void = () => undefined;
    const off = reconcileAtlasConsentAfter((cb) => {
      ready = cb;
      return () => undefined;
    });
    await Promise.resolve();
    expect(sent).toEqual([]); // nothing is decided while the list is unknown
    enableAddons(['atlas'], 'member'); // the list arrives: Atlas is installed
    ready();
    await Promise.resolve();
    off();
    expect(sent).toEqual([]);
    expect(marked).toEqual([]);
  });
  it('still withdraws once the list is known and Atlas really is not installed', async () => {
    snapshot.records = [rec('atlas-ai')];
    let ready: () => void = () => undefined;
    const off = reconcileAtlasConsentAfter((cb) => {
      ready = cb;
      return () => undefined;
    });
    ready();
    await Promise.resolve();
    off();
    expect(sent).toHaveLength(2);
  });
  it('cancel before the list arrives subscribes to nothing', async () => {
    snapshot.records = [rec('atlas-ai')];
    const cancel = vi.fn();
    const off = reconcileAtlasConsentAfter(() => cancel);
    off();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });
});
