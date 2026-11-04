import { describe, expect, it } from 'vitest';
import {
  checkCore,
  MAX_SESSIONS,
  listCore,
  revokeCore,
  revokeOthersCore,
  type SessionDoc,
  type SessionStore,
} from '../functions/src/sessionsCore';
import {
  describeClient,
  deviceKind,
  placeFromHeaders,
  validDeviceId,
} from '../functions/src/sessionsPure';

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
  it('tells the kind of device from a user-agent', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1';
    const ipad =
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1';
    const pixel =
      'Mozilla/5.0 (Linux; Android 15; Pixel 10) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
    const tab =
      'Mozilla/5.0 (Linux; Android 15; SM-X900) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
    expect(deviceKind(iphone)).toBe('phone');
    expect(deviceKind(pixel)).toBe('phone');
    expect(deviceKind(ipad)).toBe('tablet');
    expect(deviceKind(tab)).toBe('tablet');
    expect(deviceKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0')).toBe('computer');
    expect(deviceKind('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605')).toBe(
      'computer',
    );
    expect(deviceKind(undefined)).toBe('unknown');
    expect(deviceKind('curl/8')).toBe('unknown');
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
  const store: SessionStore = {
    get: async (id) => m.get(id) ?? null,
    set: async (id, d) => void m.set(id, d),
    update: async (id, p) => void m.set(id, { ...m.get(id)!, ...p }),
    list: async () => [...m].map(([deviceId, doc]) => ({ deviceId, doc })),
    remove: async (id) => void m.delete(id),
  };
  return { store, m };
}
const info = (label: string) => ({ label, kind: 'computer' as const, city: null, country: 'PL' });

describe('session rules', () => {
  it('a device with no record yet is adopted, never signed out (migration)', async () => {
    const { store, m } = memorySessions();
    expect(await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10)).toEqual({
      active: true,
      newDevice: false,
    });
    expect(m.get('dev-laptop-1')).toMatchObject({ createdAt: 10, lastSeenAt: 10, revokedAt: null });
  });

  it('flags a later device as news (push), never the first one, an old one, or one adopted into an empty list', async () => {
    const { store } = memorySessions();
    expect((await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10)).newDevice).toBe(
      false,
    );
    expect((await checkCore(store, 'dev-phone-01', info('Safari · iOS'), 11)).newDevice).toBe(true);
    expect((await checkCore(store, 'dev-phone-01', info('Safari · iOS'), 12)).newDevice).toBe(
      false,
    );
    await revokeOthersCore(store, 'dev-phone-01', 20);
    // the only live device is the phone; a new tablet is still news
    expect((await checkCore(store, 'dev-tablet-1', info('Safari · iOS'), 30)).newDevice).toBe(true);
  });

  it('signing a device out makes its next check inactive; the others stay active', async () => {
    const { store } = memorySessions();
    await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 10);
    await checkCore(store, 'dev-phone-01', info('Safari · iOS'), 11);
    await revokeCore(store, 'dev-phone-01', 20);
    expect(await checkCore(store, 'dev-phone-01', info('Safari · iOS'), 30)).toEqual({
      active: false,
      newDevice: false,
    });
    expect(await checkCore(store, 'dev-laptop-1', info('Chrome · macOS'), 31)).toEqual({
      active: true,
      newDevice: false,
    });
    expect((await listCore(store)).map((r) => r.deviceId)).toEqual(['dev-laptop-1']);
  });

  it('"sign out all except this one" ends every other session and keeps the current one', async () => {
    const { store } = memorySessions();
    for (const [i, id] of ['dev-laptop-1', 'dev-phone-01', 'dev-tablet-1'].entries())
      await checkCore(store, id, info(id), i);
    expect(await revokeOthersCore(store, 'dev-laptop-1', 50)).toBe(2);
    expect(await checkCore(store, 'dev-laptop-1', info('x'), 60)).toEqual({
      active: true,
      newDevice: false,
    });
    expect(await checkCore(store, 'dev-phone-01', info('x'), 60)).toEqual({
      active: false,
      newDevice: false,
    });
    expect(await checkCore(store, 'dev-tablet-1', info('x'), 60)).toEqual({
      active: false,
      newDevice: false,
    });
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

  it('caps the records of one account: the least recently seen go first', async () => {
    const { store, m } = memorySessions();
    for (let i = 0; i < MAX_SESSIONS; i++)
      await checkCore(store, `dev-${String(i).padStart(8, '0')}`, info('x'), i + 1);
    expect(m.size).toBe(MAX_SESSIONS);
    await checkCore(store, 'dev-new-00001', info('x'), 1000);
    expect(m.size).toBe(MAX_SESSIONS);
    expect(m.has('dev-00000000')).toBe(false);
    expect(m.has('dev-new-00001')).toBe(true);
  });

  it('eviction never drops a revocation, so a revoked device cannot re-adopt itself', async () => {
    const { store, m } = memorySessions();
    await checkCore(store, 'dev-revoked-1', info('x'), 1); // oldest
    await revokeCore(store, 'dev-revoked-1', 2);
    for (let i = 0; i < MAX_SESSIONS; i++)
      await checkCore(store, `dev-${String(i).padStart(8, '0')}`, info('x'), 10 + i);
    expect(m.get('dev-revoked-1')?.revokedAt).toBe(2);
    expect(await checkCore(store, 'dev-revoked-1', info('x'), 999)).toEqual({
      active: false,
      newDevice: false,
    });
  });
});
