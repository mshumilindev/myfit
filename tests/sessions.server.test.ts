import { describe, expect, it } from 'vitest';
import {
  checkCore,
  listCore,
  revokeCore,
  revokeOthersCore,
  type SessionDoc,
  type SessionStore,
} from '../functions/src/sessionsCore';
import { describeClient, placeFromHeaders, validDeviceId } from '../functions/src/sessionsPure';

describe('sessions helpers', () => {
  it('describes the client from a user-agent', () => {
    expect(
      describeClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      ),
    ).toBe('Chrome · macOS');
    expect(
      describeClient(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1',
      ),
    ).toBe('Safari · iOS');
    expect(
      describeClient(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36 Edg/120.0',
      ),
    ).toBe('Edge · Windows');
    expect(describeClient(undefined)).toBe('Browser');
  });
  it('takes the place from edge headers only, nothing invented', () => {
    expect(placeFromHeaders({ 'x-appengine-country': 'PL', 'x-appengine-city': 'warsaw' })).toEqual(
      { city: 'warsaw', country: 'PL' },
    );
    expect(placeFromHeaders({ 'cf-ipcountry': 'XX' })).toEqual({ city: null, country: null });
    expect(placeFromHeaders({})).toEqual({ city: null, country: null });
    expect(placeFromHeaders(undefined)).toEqual({ city: null, country: null });
  });
  it('accepts only sane device ids', () => {
    expect(validDeviceId('0b1c2d3e-4f50-6789-abcd-ef0123456789')).toBe(true);
    expect(validDeviceId('short')).toBe(false);
    expect(validDeviceId('../../x/yyyyyyyy')).toBe(false);
    expect(validDeviceId(42)).toBe(false);
  });
});

function memorySessions() {
  const m = new Map<string, SessionDoc>();
  const gone = { value: false };
  const store: SessionStore = {
    get: async (id) => m.get(id) ?? null,
    set: async (id, d) => void m.set(id, d),
    update: async (id, p) => void m.set(id, { ...m.get(id)!, ...p }),
    list: async () => [...m].map(([deviceId, doc]) => ({ deviceId, doc })),
    remove: async (id) => void m.delete(id),
    accountExists: async () => !gone.value,
  };
  return { store, m, gone };
}
const info = (label: string) => ({ label, city: null, country: 'PL' });

describe('session rules', () => {
  it('a device with no record yet is adopted, never signed out (migration)', async () => {
    const { store, m } = memorySessions();
    expect(await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10)).toEqual({
      active: true,
    });
    expect(m.get('dev-laptop-1')).toMatchObject({ createdAt: 10, lastSeenAt: 10, revokedAt: null });
  });

  it('signing a device out makes its next check inactive; the others stay active', async () => {
    const { store } = memorySessions();
    await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10);
    await checkCore(store, 'dev-phone-01', info('Safari · iOS'), 11);
    await revokeCore(store, 'dev-phone-01', 20);
    expect(await checkCore(store, 'dev-phone-01', info('Safari · iOS'), 30)).toEqual({
      active: false,
    });
    expect(await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 31)).toEqual({
      active: true,
    });
    expect((await listCore(store)).map((r) => r.deviceId)).toEqual(['dev-laptop-1']);
  });

  it('"sign out all except this one" ends every other session and keeps the current one', async () => {
    const { store } = memorySessions();
    for (const [i, id] of ['dev-laptop-1', 'dev-phone-01', 'dev-tablet-1'].entries())
      await checkCore(store, id, info(id), i);
    expect(await revokeOthersCore(store, 'dev-laptop-1', 50)).toBe(2);
    expect(await checkCore(store, 'dev-laptop-1', info('x'), 60)).toEqual({ active: true });
    expect(await checkCore(store, 'dev-phone-01', info('x'), 60)).toEqual({ active: false });
    expect(await checkCore(store, 'dev-tablet-1', info('x'), 60)).toEqual({ active: false });
    expect(await revokeOthersCore(store, 'dev-laptop-1', 70)).toBe(0);
  });

  it('lists the most recently active first and shows no revoked device', async () => {
    const { store } = memorySessions();
    await checkCore(store, 'dev-old-0001', info('Firefox · Linux'), 1);
    await checkCore(store, 'dev-new-0001', info('Chrome · macOS'), 9);
    expect((await listCore(store)).map((r) => r.deviceId)).toEqual([
      'dev-new-0001',
      'dev-old-0001',
    ]);
  });

  it('a deleted account creates nothing: the check refuses with account-gone (SPO-285 S1)', async () => {
    const { store, m, gone } = memorySessions();
    gone.value = true;
    await expect(
      checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10),
    ).rejects.toMatchObject({
      code: 'not-found',
      message: 'account-gone',
      details: { reason: 'account-gone' },
    });
    expect(m.size).toBe(0);
  });

  it('refreshing keeps the creation time and updates the place and last-seen', async () => {
    const { store, m } = memorySessions();
    await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10);
    await checkCore(
      store,
      'dev-laptop-1',
      { label: 'Chrome · macOS', city: 'warsaw', country: 'PL' },
      99,
    );
    expect(m.get('dev-laptop-1')).toMatchObject({ createdAt: 10, lastSeenAt: 99, city: 'warsaw' });
  });
});
