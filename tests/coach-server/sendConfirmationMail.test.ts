/** `sendConfirmationMail`: who may get a letter, the pause, and what happens when the mailer is not set up. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKv } from '../../functions/src/coach/memoryKv';

const h = vi.hoisted(() => ({
  user: { email: 'a@b.co', emailVerified: false } as { email?: string; emailVerified: boolean },
  status: 'active',
  locked: false,
  sent: [] as Array<{ to: string; text: string }>,
  mail: { sent: true } as { sent: boolean; reason?: string },
  linkFails: false,
  kv: null as unknown,
}));

vi.mock('../../functions/src/auth', () => ({
  isLocked: async () => h.locked,
  limiterKey: (_ip: unknown, k: string) => k,
  recordFailure: async () => undefined,
}));
vi.mock('../../functions/src/coach/firestoreKv', () => ({
  firestoreKv: () =>
    new Proxy({}, { get: (_t, k) => (h.kv as Record<string | symbol, unknown>)[k] }),
}));
vi.mock('../../functions/src/coach/runtime', () => ({
  APP_ORIGIN: { value: () => 'https://app.example.com' },
}));
vi.mock('../../functions/src/mailer', () => ({
  MAIL_API_KEY: {},
  sendMail: async (m: { to: string; text: string }) => {
    h.sent.push(m);
    return h.mail;
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
  return {
    HttpsError,
    verifyPassword: () => true,
    db: {
      collection: () => ({
        doc: () => ({ get: async () => ({ data: () => ({ status: h.status }) }) }),
      }),
    },
    authAdmin: {
      getUser: async () => h.user,
      generateEmailVerificationLink: async () => {
        if (h.linkFails) throw new Error('auth/unauthorized-continue-uri');
        return 'https://app.example.com/__/auth/action?oobCode=x';
      },
    },
  };
});

import { sendConfirmationMail } from '../../functions/src/emailAuth';

const call = (data: Record<string, unknown> = {}, auth: { uid: string } | null = { uid: 'u1' }) =>
  (sendConfirmationMail as unknown as { run: (r: unknown) => Promise<unknown> }).run({
    auth,
    data,
  });

beforeEach(() => {
  const kv = createMemoryKv();
  void kv.set('emails/a%40b.co', { userId: 'u1', verifiedAt: null, updatedAt: 1 });
  h.kv = kv;
  h.user = { email: 'a@b.co', emailVerified: false };
  h.status = 'active';
  h.locked = false;
  h.sent = [];
  h.mail = { sent: true };
  h.linkFails = false;
});

describe('sendConfirmationMail', () => {
  it('sends one letter to the account email and answers without the address', async () => {
    await expect(call({ locale: 'uk' })).resolves.toEqual({ sent: true, verified: false });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].to).toBe('a@b.co');
  });
  it('needs a signed-in caller', async () => {
    await expect(call({}, null)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('refuses a suspended account and a locked limiter', async () => {
    h.status = 'suspended';
    await expect(call()).rejects.toMatchObject({ code: 'permission-denied' });
    h.status = 'active';
    h.locked = true;
    await expect(call()).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(h.sent).toHaveLength(0);
  });
  it('does nothing for a confirmed address and fails clearly without one', async () => {
    h.user = { email: 'a@b.co', emailVerified: true };
    await expect(call()).resolves.toEqual({ sent: false, verified: true });
    h.user = { emailVerified: false };
    await expect(call()).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(h.sent).toHaveLength(0);
  });
  it('waits a minute between letters', async () => {
    await call();
    await expect(call()).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(h.sent).toHaveLength(1);
  });
  it('reports a missing mailer as failed-precondition and a Firebase link error as internal', async () => {
    h.mail = { sent: false, reason: 'not-configured' };
    await expect(call()).rejects.toMatchObject({ code: 'failed-precondition' });
    h.linkFails = true;
    (h.kv as ReturnType<typeof createMemoryKv>).set('emails/a%40b.co', {
      userId: 'u1',
      verifiedAt: null,
      updatedAt: 1,
    });
    await expect(call()).rejects.toMatchObject({ code: 'internal' });
  });
});
