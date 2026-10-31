/** Forgot-password (SPO-225): who gets a letter, no enumeration, one letter a minute, the one-hour link, and the data key. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKv } from '../../functions/src/coach/memoryKv';
import { vaultKeyFor } from '../../functions/src/vault';
import { requestReset, RESET_TTL_MS, type ResetPorts } from '../../functions/src/passwordResetCore';

const NOW = 1_000_000;
const setup = (
  over: Partial<{
    verifiedAt: number | null;
    status: string;
    authEmail: string;
    authVerified: boolean;
  }> = {},
) => {
  const kv = createMemoryKv();
  void kv.set('emails/a%40b.co', {
    userId: 'u1',
    verifiedAt: over.verifiedAt === undefined ? 1 : over.verifiedAt,
    updatedAt: 1,
  });
  const log = { issued: [] as string[], sent: [] as Array<{ email: string; token: string }> };
  const ports: ResetPorts = {
    authRecord: async () => ({
      email: over.authEmail ?? 'a@b.co',
      verified: over.authVerified ?? true,
    }),
    userStatus: async () => (over.status ?? 'active') as 'active',
    issue: async (uid) => {
      log.issued.push(uid);
      return 'tok';
    },
    send: async (email, token) => {
      log.sent.push({ email, token });
      return true;
    },
  };
  return { kv, ports, log };
};

describe('requestReset', () => {
  it('sends one letter to a confirmed address of an active account', async () => {
    const { kv, ports, log } = setup();
    expect(await requestReset(kv, ports, ' A@B.co ', NOW)).toBe('sent');
    expect(log.sent).toEqual([{ email: 'a@b.co', token: 'tok' }]);
  });
  it.each([
    ['not an address', 'nope', {}],
    ['unknown address', 'x@y.co', {}],
    ['unconfirmed index', 'a@b.co', { verifiedAt: null }],
    ['Auth email changed', 'a@b.co', { authEmail: 'other@b.co' }],
    ['Auth says unconfirmed', 'a@b.co', { authVerified: false }],
    ['suspended account', 'a@b.co', { status: 'suspended' }],
    ['invited account', 'a@b.co', { status: 'invited' }],
  ])('does nothing for %s (and looks the same)', async (_n, email, over) => {
    const { kv, ports, log } = setup(over);
    expect(await requestReset(kv, ports, email, NOW)).toBe('skipped');
    expect(log.issued).toHaveLength(0);
    expect(log.sent).toHaveLength(0);
  });
  it('allows one letter a minute per address', async () => {
    const { kv, ports, log } = setup();
    expect(await requestReset(kv, ports, 'a@b.co', NOW)).toBe('sent');
    expect(await requestReset(kv, ports, 'a@b.co', NOW + 30_000)).toBe('skipped');
    expect(await requestReset(kv, ports, 'a@b.co', NOW + 61_000)).toBe('sent');
    expect(log.sent).toHaveLength(2);
  });
  it('reports a mailer failure to the caller only as an outcome', async () => {
    const { kv, ports } = setup();
    ports.send = async () => false;
    expect(await requestReset(kv, ports, 'a@b.co', NOW)).toBe('failed');
  });
  it('the link lives one hour', () => {
    expect(RESET_TTL_MS).toBe(3_600_000);
  });
});

const MASTER = Buffer.alloc(32, 7).toString('base64'); // synthetic

describe('the data key and the password', () => {
  it('the vault key depends on the account only, so a new password cannot make data unreadable', () => {
    const before = vaultKeyFor(MASTER, 'u1', 1);
    // A password reset writes credentials/{uid} only; nothing of it is an input of the key.
    const after = vaultKeyFor(MASTER, 'u1', 1);
    expect(after).toEqual(before);
    expect(vaultKeyFor(MASTER, 'u2', 1).key).not.toBe(before.key);
  });
});

/** The callable: the answer is the same for a known and an unknown address; the IP limit is the only told refusal. */
const h = vi.hoisted(() => ({
  locked: new Set<string>(),
  sent: 0,
  kv: null as unknown,
  issued: [] as Array<Record<string, unknown>>,
}));
vi.mock('../../functions/src/auth', () => ({
  isLocked: async (k: string) => h.locked.has(k),
  limiterKey: (ip: string | undefined, k: string) => `${ip ?? 'noip'}|${k}`,
  recordFailure: async () => undefined,
}));
vi.mock('../../functions/src/coach/firestoreKv', () => ({
  firestoreKv: () =>
    new Proxy({}, { get: (_t, k) => (h.kv as Record<string | symbol, unknown>)[k] }),
}));
vi.mock('../../functions/src/coach/runtime', () => ({
  APP_ORIGIN: { value: () => 'https://app.example.com' },
  ENFORCE_APPCHECK: false,
}));
vi.mock('../../functions/src/mailer', () => ({
  MAIL_API_KEY: {},
  sendMail: async () => {
    h.sent += 1;
    return { sent: true };
  },
}));
vi.mock('../../functions/src/lib', () => {
  class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  const batch = () => {
    const ops: Array<() => void> = [];
    return {
      update: () => undefined,
      set: (_r: unknown, v: Record<string, unknown>) => ops.push(() => h.issued.push(v)),
      commit: async () => ops.forEach((o) => o()),
    };
  };
  return {
    HttpsError,
    HOT: {},
    requireAuth: () => 'u1',
    newToken: () => 'tok123',
    authAdmin: { getUser: async () => ({ email: 'a@b.co', emailVerified: true }) },
    db: {
      batch,
      collection: (c: string) => ({
        doc: (id: string) => ({
          get: async () => ({ data: () => (c === 'users' ? { status: 'active' } : undefined) }),
          id,
        }),
        where: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }),
      }),
    },
  };
});

import { requestPasswordReset } from '../../functions/src/passwordReset';

const call = (email: unknown) =>
  (requestPasswordReset as unknown as { run: (r: unknown) => Promise<unknown> }).run({
    data: { email, locale: 'uk' },
    rawRequest: { ip: '1.1.1.1' },
  });

describe('requestPasswordReset', () => {
  beforeEach(() => {
    const kv = createMemoryKv();
    void kv.set('emails/a%40b.co', { userId: 'u1', verifiedAt: 1, updatedAt: 1 });
    h.kv = kv;
    h.locked.clear();
    h.sent = 0;
    h.issued = [];
  });
  it('answers ok for a known and an unknown address alike, sending only for the known one', async () => {
    await expect(call('a@b.co')).resolves.toEqual({ ok: true });
    await expect(call('nobody@b.co')).resolves.toEqual({ ok: true });
    expect(h.sent).toBe(1);
    expect(h.issued[0]).toMatchObject({ kind: 'reset', userId: 'u1', claimedAt: null });
    expect((h.issued[0].expiresAt as number) - (h.issued[0].createdAt as number)).toBe(
      RESET_TTL_MS,
    );
  });
  it('rejects a malformed request and tells an IP lockout, but hides an address lockout', async () => {
    await expect(call(42)).rejects.toMatchObject({ code: 'invalid-argument' });
    h.locked.add('1.1.1.1|reset');
    await expect(call('a@b.co')).rejects.toMatchObject({ code: 'resource-exhausted' });
    h.locked.clear();
    h.locked.add('noip|reset:a@b.co');
    await expect(call('a@b.co')).resolves.toEqual({ ok: true });
    expect(h.sent).toBe(0);
  });
});
