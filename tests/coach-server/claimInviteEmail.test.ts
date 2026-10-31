/** `claim` of an invitation that carries an email: the account gets it unverified, and a taken address never burns the invite. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
const h = vi.hoisted(() => ({
  store: new Map<string, Doc>(),
  created: [] as Array<Record<string, unknown>>,
  failWithEmail: false,
}));

vi.mock('../../functions/src/coach/firestoreKv', () => ({ firestoreKv: () => ({}) }));
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
  const ref = (path: string) => ({
    async get() {
      const d = h.store.get(path);
      return { exists: !!d, data: () => d };
    },
    async set(v: Doc) {
      h.store.set(path, v);
    },
    async update(v: Doc) {
      h.store.set(path, { ...h.store.get(path), ...v });
    },
    async delete() {
      h.store.delete(path);
    },
  });
  return {
    HttpsError,
    HOT: {},
    db: {
      collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: (r: { get: () => Promise<unknown> }) => r.get(),
          set: (r: { set: (v: Doc) => Promise<void> }, v: Doc) => void r.set(v),
          update: (r: { update: (v: Doc) => Promise<void> }, v: Doc) => void r.update(v),
          delete: (r: { delete: () => Promise<void> }) => void r.delete(),
        }),
    },
    authAdmin: {
      getUser: async () => {
        throw new Error('auth/user-not-found');
      },
      createUser: async (u: Record<string, unknown>) => {
        if (u.email && h.failWithEmail) throw new Error('auth/email-already-exists');
        h.created.push(u);
      },
      revokeRefreshTokens: async () => undefined,
    },
    bucket: {},
    displayName: (u: { firstName?: string }) => u.firstName ?? '',
    hashPassword: (p: string) => `h:${p}`,
    verifyPassword: () => false,
    mintToken: async (uid: string) => `token-${uid}`,
    authPayload: (u: { id: string }, token: string) => ({ userId: u.id, token }),
    parseNameInput: (b: { firstName?: string; lastName?: string }) => ({
      firstName: (b.firstName ?? '').trim(),
      lastName: (b.lastName ?? '').trim(),
    }),
    usernameRef: (l: string) => ref(`usernames/${l}`),
    validPassword: () => true,
  };
});

import { claim } from '../../functions/src/auth';

const run = (data: Record<string, unknown>) =>
  (claim as unknown as { run: (r: unknown) => Promise<{ userId: string }> }).run({
    data,
    rawRequest: { ip: '1.1.1.1' },
  });

beforeEach(() => {
  h.store.clear();
  h.created.length = 0;
  h.failWithEmail = false;
  h.store.set('users/u1', {
    username: 'invited-ab12cd34',
    usernameLower: 'invited-ab12cd34',
    firstName: '',
    lastName: '',
    role: 'member',
    status: 'invited',
  });
  h.store.set('usernames/invited-ab12cd34', { userId: 'u1' });
  h.store.set('invites/t1', {
    token: 't1',
    userId: 'u1',
    createdBy: 'a',
    kind: 'invite',
    createdAt: 1,
    expiresAt: Date.now() + 1e6,
    claimedAt: null,
    revokedAt: null,
    reRequestedAt: null,
    email: 'ann@example.com',
  });
});

const body = { token: 't1', password: 'pw123456', firstName: 'Ann', username: 'ann' };

describe('claim with an invited email', () => {
  it('creates the Auth user with the address (unverified) and clears it from the invite', async () => {
    await run(body);
    expect(h.created[0]).toMatchObject({
      uid: 'u1',
      email: 'ann@example.com',
      emailVerified: false,
    });
    expect(h.store.get('invites/t1')).toMatchObject({ email: null });
    expect(h.store.get('users/u1')).toMatchObject({ status: 'active', username: 'ann' });
  });

  it('still completes when the address was taken in Auth meanwhile (no email on the account)', async () => {
    h.failWithEmail = true;
    await run(body);
    expect(h.created).toHaveLength(1);
    expect(h.created[0]).not.toHaveProperty('email');
    expect(h.store.get('users/u1')).toMatchObject({ status: 'active' });
  });

  it('refuses the reserved placeholder as a chosen username and leaves the invite usable', async () => {
    await expect(run({ ...body, username: 'invited-zzzzzzzz' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(h.store.get('invites/t1')).toMatchObject({ claimedAt: null });
  });
});
