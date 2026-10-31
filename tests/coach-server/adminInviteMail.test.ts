/** Admin invitations send a letter every time (email required, names optional); a failed letter never loses the invite. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
const h = vi.hoisted(() => ({
  store: new Map<string, Doc>(),
  authEmails: new Map<string, string>(),
  sent: [] as Array<{ to: string; text: string }>,
  mail: { sent: true } as { sent: boolean; reason?: string },
  n: 0,
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
  const ref = (path: string) => ({
    path,
    async get() {
      const d = h.store.get(path);
      return { exists: !!d, data: () => d, ref: ref(path), id: path.split('/')[1] };
    },
    async set(v: Doc) {
      h.store.set(path, v);
    },
    async update(v: Doc) {
      h.store.set(path, { ...h.store.get(path), ...v });
    },
  });
  const query = (c: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(c, [...filters, [f, v]]),
    async get() {
      const docs = [...h.store.entries()]
        .filter(([p, d]) => p.startsWith(`${c}/`) && filters.every(([f, v]) => d[f] === v))
        .map(([p, d]) => ({ id: p.split('/')[1], ref: ref(p), data: () => d }));
      return { docs };
    },
  });
  const user = (id: string) => ({ id, ...(h.store.get(`users/${id}`) as Doc) });
  return {
    HttpsError,
    newId: () => `id${++h.n}abcdef12`,
    newToken: () => `tok${++h.n}`,
    displayName: (u: { firstName?: string; username: string }) => u.firstName || u.username,
    parseNameInput: (b: { firstName?: string; lastName?: string }) => ({
      firstName: (b.firstName ?? '').toString().trim(),
      lastName: (b.lastName ?? '').toString().trim(),
    }),
    usernameRef: (l: string) => ref(`usernames/${l}`),
    createNotice: async () => undefined,
    recordAudit: async () => undefined,
    requireRole: async () => ({ uid: 'admin1', user: user('admin1') }),
    db: {
      collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`), ...query(c, []) }),
      batch: () => {
        const ops: Array<() => Promise<void>> = [];
        return {
          update: (r: { update: (v: Doc) => Promise<void> }, v: Doc) =>
            void ops.push(() => r.update(v)),
          set: (r: { set: (v: Doc) => Promise<void> }, v: Doc) => void ops.push(() => r.set(v)),
          commit: async () => void (await Promise.all(ops.map((o) => o()))),
        };
      },
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          get: (r: { get: () => Promise<unknown> }) => r.get(),
          set: (r: { set: (v: Doc) => Promise<void> }, v: Doc) => void r.set(v),
        }),
    },
    authAdmin: {
      getUser: async (uid: string) => {
        const email = h.authEmails.get(uid);
        if (email === undefined)
          throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
        return { email };
      },
      getUserByEmail: async (e: string) => {
        if ([...h.authEmails.values()].includes(e)) return {};
        throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
      },
    },
  };
});
vi.mock('../../functions/src/mailer', () => ({
  CF_EMAIL_TOKEN: {},
  sendMail: async (m: { to: string; text: string }) => {
    h.sent.push(m);
    return h.mail;
  },
}));
vi.mock('../../functions/src/coach/runtime', () => ({
  APP_ORIGIN: { value: () => 'https://app.example.com' },
  coachCallOptions: {},
  coachCtx: () => ({}),
  coachKv: () => ({}),
}));
vi.mock('../../functions/src/aggregates', () => ({
  listUserWorkouts: async () => [],
  volume30d: () => 0,
  lastSession: () => ({ at: null, live: false, liveStartedAt: null }),
  workoutStrengthStats: () => ({}),
}));
vi.mock('../../functions/src/coach/legacy', () => ({
  aggregateWorkouts: () => ({}),
  cutWorkouts: () => [],
  legacyCut: () => ({}),
}));
vi.mock('../../functions/src/coach/lifecycle', () => ({}));
vi.mock('../../functions/src/passkeysStore', () => ({ deletePasskeysOf: async () => undefined }));
vi.mock('../../functions/src/coach/service', () => ({ CoachError: class extends Error {} }));
vi.mock('../../functions/src/accountDeletion', () => ({ adminCascade: async () => undefined }));

import { adminCreateUser, adminIssueInvite, adminResetPassword } from '../../functions/src/admin';

type Fn = (req: unknown) => Promise<{
  invite: { token: string; email: string | null };
  mail: { sent: boolean; reason?: string };
}>;
const run = (f: unknown, data: Record<string, unknown>) =>
  (f as { run: Fn }).run({ data, auth: { uid: 'admin1' } });

beforeEach(() => {
  h.store.clear();
  h.authEmails.clear();
  h.sent.length = 0;
  h.mail = { sent: true };
  h.store.set('users/admin1', { role: 'admin', status: 'active', username: 'root' });
});

describe('adminCreateUser', () => {
  it('requires a valid email', async () => {
    await expect(run(adminCreateUser, { email: 'nope' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(run(adminCreateUser, {})).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('creates the account from the email alone, reserves it and sends the letter with the link', async () => {
    const r = await run(adminCreateUser, { email: ' Ann@Example.com ', locale: 'uk' });
    expect(r.mail).toEqual({ sent: true });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].to).toBe('ann@example.com');
    expect(h.sent[0].text).toContain(`https://app.example.com/#/join/${r.invite.token}`);
    expect(h.store.get('emails/ann%40example.com')).toMatchObject({ verifiedAt: null });
    const users = [...h.store.entries()].filter(([p]) => p.startsWith('users/id'));
    expect(users[0][1]).toMatchObject({ status: 'invited', firstName: '' });
    expect(String(users[0][1].username)).toMatch(/^invited-/);
  });

  it('a failed letter still returns the invite (link and QR stay usable)', async () => {
    h.mail = { sent: false, reason: 'rejected' };
    const r = await run(adminCreateUser, { email: 'ann@example.com' });
    expect(r.mail).toEqual({ sent: false, reason: 'rejected' });
    expect(h.store.get(`invites/${r.invite.token}`)).toBeTruthy();
  });

  it('refuses an address that is taken in the index or in Auth', async () => {
    await run(adminCreateUser, { email: 'ann@example.com' });
    await expect(run(adminCreateUser, { email: 'ANN@example.com' })).rejects.toMatchObject({
      code: 'already-exists',
    });
    h.authEmails.set('x', 'bob@example.com');
    await expect(run(adminCreateUser, { email: 'bob@example.com' })).rejects.toMatchObject({
      code: 'already-exists',
    });
  });

  it('refuses an @ in an explicit username', async () => {
    await expect(run(adminCreateUser, { email: 'a@b.co', username: 'a@b' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });
});

describe('resend and reset', () => {
  async function invited() {
    const r = await run(adminCreateUser, { email: 'ann@example.com' });
    const id = [...h.store.keys()].find((p) => p.startsWith('users/id'))!.split('/')[1];
    // age the first invite past the one-minute cooldown
    h.store.set(`invites/${r.invite.token}`, {
      ...h.store.get(`invites/${r.invite.token}`),
      createdAt: 1,
    });
    return id;
  }

  it('a new link mails the address the admin entered, once a minute at most', async () => {
    const id = await invited();
    h.sent.length = 0;
    const r = await run(adminIssueInvite, { id });
    expect(r.mail.sent).toBe(true);
    expect(h.sent[0].to).toBe('ann@example.com');
    await expect(run(adminIssueInvite, { id })).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('a reset letter goes only to a confirmed address', async () => {
    const id = await invited();
    h.sent.length = 0;
    const r = await run(adminResetPassword, { id });
    expect(r.mail).toEqual({ sent: false, reason: 'not-verified' });
    expect(h.sent).toHaveLength(0);
    expect(r.invite.token).toBeTruthy(); // the admin can still pass the link on
  });

  it('a reset letter is sent once the address is confirmed', async () => {
    const id = await invited();
    h.authEmails.set(id, 'ann@example.com');
    h.store.set('emails/ann%40example.com', { userId: id, verifiedAt: 5 });
    h.sent.length = 0;
    const r = await run(adminResetPassword, { id });
    expect(r.mail.sent).toBe(true);
    expect(h.sent[0].to).toBe('ann@example.com');
  });
});
