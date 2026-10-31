/** `login` signs in by a confirmed email as well as by username (SPO-224); every other case answers like an unknown name. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';

const h = vi.hoisted(() => ({
  kv: null as unknown,
  auth: new Map<string, { email: string | null; emailVerified: boolean }>(),
}));

// `auth.ts` builds its Kv at import time, before each test installs a fresh one: forward every call to the current one.
vi.mock('../../functions/src/coach/firestoreKv', () => ({
  firestoreKv: () =>
    new Proxy({}, { get: (_t, k) => (h.kv as Record<string | symbol, unknown>)[k] }),
}));
vi.mock('../../functions/src/passkeysStore', () => ({ deletePasskeysOf: async () => undefined }));
vi.mock('../../functions/src/lib', () => {
  class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  const kv = () => h.kv as MemoryKv;
  const doc = (path: string) => ({
    async get() {
      const d = await kv().get(path);
      return { exists: d !== null, data: () => d ?? undefined };
    },
    async set(v: Record<string, unknown>) {
      await kv().set(path, v);
    },
    async delete() {
      await kv().del(path);
    },
  });
  return {
    HttpsError,
    HOT: {},
    db: {
      collection: (c: string) => ({ doc: (id: string) => doc(`${c}/${id}`) }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: (r: { get: () => Promise<unknown> }) => r.get(),
          set: (
            r: { set: (v: Record<string, unknown>) => Promise<void> },
            v: Record<string, unknown>,
          ) => r.set(v),
          update: (
            r: { set: (v: Record<string, unknown>) => Promise<void> },
            v: Record<string, unknown>,
          ) => r.set(v),
        }),
    },
    authAdmin: {
      getUser: async (uid: string) => {
        const u = h.auth.get(uid);
        if (!u) throw new Error('auth/user-not-found');
        return u;
      },
    },
    bucket: {},
    displayName: () => '',
    hashPassword: (p: string) => `h:${p}`,
    verifyPassword: (p: string, hash: string) => hash === `h:${p}`,
    mintToken: async (uid: string) => `token-${uid}`,
    authPayload: (u: { id: string }, token: string) => ({ userId: u.id, token }),
    parseNameInput: () => ({}),
    usernameRef: (lower: string) => doc(`usernames/${lower}`),
    validPassword: () => true,
  };
});

import { login } from '../../functions/src/auth';

type Handler = (req: unknown) => Promise<{ userId: string; token: string }>;
const call = (identifier: string, password = 'pw123456') =>
  (login as unknown as { run: Handler }).run({
    data: { identifier, password },
    rawRequest: { ip: '1.1.1.1' },
  });

let kv: MemoryKv;
beforeEach(async () => {
  kv = createMemoryKv();
  h.kv = kv;
  h.auth.clear();
  h.auth.set('u1', { email: 'ada@example.com', emailVerified: true });
  await kv.set('users/u1', { role: 'member', status: 'active', usernameLower: 'ada' });
  await kv.set('credentials/u1', { passwordHash: 'h:pw123456' });
  await kv.set('usernames/ada', { userId: 'u1' });
});

describe('login by email', () => {
  it('still signs in by username', async () => {
    expect((await call('ada')).userId).toBe('u1');
  });

  it('signs in by a confirmed email, any case', async () => {
    await kv.set('emails/ada%40example.com', { userId: 'u1', verifiedAt: 5, updatedAt: 5 });
    expect((await call('Ada@Example.com')).userId).toBe('u1');
  });

  it('refuses an index entry that Auth no longer backs (the address was changed or unconfirmed elsewhere)', async () => {
    await kv.set('emails/ada%40example.com', { userId: 'u1', verifiedAt: 5, updatedAt: 5 });
    h.auth.set('u1', { email: 'other@example.com', emailVerified: true });
    await expect(call('ada@example.com')).rejects.toThrow('Wrong username or password.');
    h.auth.set('u1', { email: 'ada@example.com', emailVerified: false });
    await expect(call('ada@example.com')).rejects.toThrow('Wrong username or password.');
  });

  it('a username that contains an @ keeps signing in by that name', async () => {
    await kv.set('users/u2', { role: 'member', status: 'active', usernameLower: 'bob@old.net' });
    await kv.set('credentials/u2', { passwordHash: 'h:pw123456' });
    await kv.set('usernames/bob@old.net', { userId: 'u2' });
    expect((await call('Bob@old.net')).userId).toBe('u2');
  });

  it('refuses an unconfirmed email, an unknown email and a wrong password the same way', async () => {
    await kv.set('emails/ada%40example.com', { userId: 'u1', verifiedAt: null, updatedAt: 5 });
    const msgs: string[] = [];
    for (const [id, pw] of [
      ['ada@example.com', 'pw123456'],
      ['ghost@example.com', 'pw123456'],
      ['ada', 'wrong-pass'],
    ] as const) {
      await call(id, pw).catch((e: Error) =>
        msgs.push(`${(e as unknown as { code: string }).code}|${e.message}`),
      );
    }
    expect(msgs).toEqual(Array(3).fill('unauthenticated|Wrong username or password.'));
  });

  it('refuses an email longer than an address can be', async () => {
    await expect(call(`${'a'.repeat(260)}@x.com`)).rejects.toThrow('Wrong username or password.');
  });
});
