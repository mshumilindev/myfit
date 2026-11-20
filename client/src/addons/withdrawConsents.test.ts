import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '../legal/consents';

const sent = vi.hoisted(() => [] as { kind: string; action: string }[]);
const marked = vi.hoisted(() => [] as string[]);
const health = vi.hoisted(() => [] as string[]);
const shared = vi.hoisted(() => ({ forgot: [] as string[], levels: [] as string[] }));
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
  sendConsentDurably: async (i: { kind: string; action: string }) => (sent.push(i), true),
}));
vi.mock('../legal/healthConsentActions', async (orig) => ({
  ...(await orig<typeof import('../legal/healthConsentActions')>()),
  withdrawHealth: async (f: string) => (health.push(f), true),
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  forgetShareLevel: (k: string) => void shared.forgot.push(k),
}));
vi.mock('../coach/client/data/config', () => ({
  getClientPort: () => ({
    setLevel: async (c: string, l: string) => void shared.levels.push(`${c}:${l}`),
  }),
}));
vi.mock('../legal/consentApi', async (orig) => ({
  ...(await orig<typeof import('../legal/consentApi')>()),
  subscribeConsentRecords: (_u: string, on: (r: unknown[], m: { fromCache: boolean }) => void) => {
    queueMicrotask(() => on(snapshot.records, { fromCache: snapshot.fromCache }));
    return () => undefined;
  },
}));

import { resetAiOverride } from '../atlas/aiConsent';
import { addonsPref, disableAddons, enableAddons } from './enabledSet';
import {
  entriesOwnedBy,
  orphanedOn,
  reconcileOrphanedConsents,
  reconcileOrphanedConsentsAfter,
  watchAddonRemoval,
} from './withdrawConsents';

const rec = (kind: string): ConsentRecord =>
  ({ id: kind, kind, action: 'grant', version: '2099-01-01', at: 1 }) as unknown as ConsentRecord;

beforeEach(() => {
  sent.length = 0;
  marked.length = 0;
  health.length = 0;
  shared.forgot.length = 0;
  shared.levels.length = 0;
  snapshot.records = [];
  snapshot.fromCache = false;
  addonsPref.reset();
  resetAiOverride(false);
});

describe('removing an add-on withdraws the consents it owned (SPO-571)', () => {
  it('Cycle: withdraws exactly the Cycle consent', () => {
    enableAddons(['health', 'cycle', 'alcohol'], 'member');
    const off = watchAddonRemoval();
    disableAddons(['cycle'], 'member');
    off();
    expect(health).toEqual(['cycle']);
    expect(sent).toEqual([]);
  });

  it('Atlas: both AI engines are withdrawn, the saved chat copy is kept', () => {
    enableAddons(['atlas'], 'member');
    const off = watchAddonRemoval();
    disableAddons(['atlas'], 'member');
    off();
    expect(sent.map((s) => s.kind).sort()).toEqual(['atlas-ai', 'atlas-puter']);
    expect(sent.some((s) => s.kind === 'atlas-history')).toBe(false);
  });

  it('removing an app takes its add-ons with it: Health withdraws the health consents of its modules', () => {
    enableAddons(['health', 'cycle', 'nicotine'], 'member');
    const off = watchAddonRemoval();
    disableAddons(['health'], 'member');
    off();
    expect(health.sort()).toEqual(['cycle', 'nicotine']);
  });

  it('something never installed, or something that owns no consent, withdraws nothing', () => {
    enableAddons(['sleep'], 'member');
    const off = watchAddonRemoval();
    disableAddons(['cycle'], 'member');
    disableAddons(['sleep'], 'member');
    off();
    expect(health).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('Sleep and Planner own no consent, but the trainer stops seeing what they share', async () => {
    enableAddons(['sleep', 'planner'], 'member');
    const off = watchAddonRemoval();
    disableAddons(['sleep', 'planner'], 'member');
    off();
    await vi.waitFor(() => expect(shared.levels).toEqual(['sleep:off']));
    expect(shared.forgot).toEqual(['availability']);
    expect(health).toEqual([]);
  });

  it('sign-out, a synced list and a role change are not removals', () => {
    enableAddons(['health', 'cycle', 'atlas'], 'member');
    const off = watchAddonRemoval();
    addonsPref.set([]); // a synced list from another device
    addonsPref.reset(); // sign-out / account switch (`resetLocalData`)
    off();
    expect(health).toEqual([]);
    expect(sent).toEqual([]);
    expect(marked).toEqual([]);
  });

  it('maps owners from the registry', () => {
    expect(entriesOwnedBy(new Set(['alcohol'])).map((e) => e.id)).toEqual(['alcohol']);
    expect(entriesOwnedBy(new Set(['atlas'])).map((e) => e.id)).toEqual([
      'atlas-ai',
      'atlas-puter',
    ]);
    expect(entriesOwnedBy(new Set(['sleep']))).toEqual([]);
  });
});

describe('consents whose add-on is not installed (removed on another device)', () => {
  it('lists only consents that are on AND whose owner can be installed but is not', () => {
    enableAddons(['health', 'alcohol'], 'member');
    const on = [rec('health:alcohol'), rec('health:cycle'), rec('health:nutrition'), rec('terms')];
    // alcohol installed -> kept; cycle not installed -> orphaned; nutrition is "coming soon" (not installable) -> kept
    expect(orphanedOn(on).map((e) => e.id)).toEqual(['cycle']);
  });

  it('withdraws only after the server answered, not on a cache-only snapshot', async () => {
    snapshot.records = [rec('health:cycle')];
    snapshot.fromCache = true;
    const off = reconcileOrphanedConsents();
    await Promise.resolve();
    expect(health).toEqual([]);
    off();
    snapshot.fromCache = false;
    const off2 = reconcileOrphanedConsents();
    await Promise.resolve();
    off2();
    expect(health).toEqual(['cycle']);
  });

  it('does nothing when the add-on is reinstalled before the answer arrives', async () => {
    snapshot.records = [rec('health:cycle')];
    const off = reconcileOrphanedConsents();
    enableAddons(['health', 'cycle'], 'member');
    await Promise.resolve();
    off();
    expect(health).toEqual([]);
  });

  it('waits for the add-on list: nothing is decided before it is known', async () => {
    snapshot.records = [rec('health:cycle')];
    let ready: () => void = () => undefined;
    const off = reconcileOrphanedConsentsAfter((cb) => {
      ready = cb;
      return () => undefined;
    });
    await Promise.resolve();
    expect(health).toEqual([]);
    enableAddons(['health', 'cycle'], 'member'); // the list arrives and Cycle is installed
    ready();
    await Promise.resolve();
    off();
    expect(health).toEqual([]);
  });
});
