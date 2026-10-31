/** Linking an email to an existing account and signing in by it (SPO-283, SPO-224): rules of `emailAuthCore` on the in-memory Kv. */
import { describe, expect, it } from 'vitest';
import { createMemoryKv } from '../../functions/src/coach/memoryKv';
import {
  attachEmail,
  emailLoginUser,
  emailStatus,
  looksLikeEmail,
  normalizeEmail,
  type AttachPorts,
  type AuthEmail,
} from '../../functions/src/emailAuthCore';

const NOW = Date.UTC(2026, 10, 1, 12);

/** A fake Firebase Auth: one record per uid, plus the set of emails Auth already knows. */
function fakeAuth(initial: Record<string, AuthEmail> = {}, authKnows: string[] = []) {
  const users = new Map(Object.entries(initial));
  const calls: string[] = [];
  const ports: AttachPorts = {
    async current(uid) {
      return users.get(uid) ?? { email: null, verified: false };
    },
    async setEmail(uid, email) {
      calls.push(`${uid}:${email}`);
      if (authKnows.includes(email)) throw new Error('email-taken');
      users.set(uid, { email, verified: false });
    },
  };
  return { ports, users, calls };
}

describe('normalizeEmail', () => {
  it('lower-cases and trims, and refuses anything that is not an address', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    for (const bad of [
      '',
      'ada',
      'ada@',
      '@x.com',
      'a b@x.com',
      'a@x',
      'a@@x.com',
      'a..b@x.com',
      '.a@x.com',
      'a.@x.com',
      'a@x.c',
      5,
      null,
      'x'.repeat(250) + '@x.com',
    ])
      expect(normalizeEmail(bad), String(bad)).toBeNull();
  });
  it('tells an email from a username', () => {
    expect(looksLikeEmail('ada@x.com')).toBe(true);
    expect(looksLikeEmail('ada')).toBe(false);
  });
});

describe('attachEmail', () => {
  it('reserves the address, writes it unverified and keeps sign-in closed until it is confirmed', async () => {
    const kv = createMemoryKv();
    const { ports, calls } = fakeAuth();
    expect(await attachEmail(kv, ports, 'u1', 'Ada@Example.com', NOW)).toEqual({
      ok: true,
      email: 'ada@example.com',
      verified: false,
    });
    expect(calls).toEqual(['u1:ada@example.com']);
    expect(await emailLoginUser(kv, 'ada@example.com')).toBeNull();
  });

  it('refuses an invalid address without touching anything', async () => {
    const kv = createMemoryKv();
    const { ports, calls } = fakeAuth();
    expect(await attachEmail(kv, ports, 'u1', 'nope', NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(calls).toEqual([]);
    expect(kv.paths()).toEqual([]);
  });

  it('refuses an address that belongs to another account, never merges, and does not say whose', async () => {
    const kv = createMemoryKv();
    const a = fakeAuth();
    await attachEmail(kv, a.ports, 'u1', 'ada@example.com', NOW);
    const b = fakeAuth();
    const r = await attachEmail(kv, b.ports, 'u2', 'ADA@example.com', NOW);
    expect(r).toEqual({ ok: false, reason: 'taken' });
    expect(JSON.stringify(r)).not.toContain('u1');
    expect(b.calls).toEqual([]);
    expect((await kv.get('emails/ada%40example.com'))?.userId).toBe('u1');
  });

  it('rolls the reservation back when Auth already knows the address elsewhere', async () => {
    const kv = createMemoryKv();
    const { ports } = fakeAuth({}, ['ada@example.com']);
    expect(await attachEmail(kv, ports, 'u1', 'ada@example.com', NOW)).toEqual({
      ok: false,
      reason: 'taken',
    });
    expect(kv.paths()).toEqual([]);
  });

  it('changing the address frees the old entry and resets the confirmation', async () => {
    const kv = createMemoryKv();
    const { ports, users } = fakeAuth();
    await attachEmail(kv, ports, 'u1', 'old@example.com', NOW);
    users.set('u1', { email: 'old@example.com', verified: true });
    await emailStatus(kv, ports, 'u1', NOW);
    expect(await emailLoginUser(kv, 'old@example.com')).toBe('u1');
    await attachEmail(kv, ports, 'u1', 'new@example.com', NOW + 1);
    expect(kv.has('emails/old%40example.com')).toBe(false);
    expect(await emailLoginUser(kv, 'old@example.com')).toBeNull();
    expect(await emailLoginUser(kv, 'new@example.com')).toBeNull();
    expect(users.get('u1')).toEqual({ email: 'new@example.com', verified: false });
  });

  it('the same address again changes nothing and keeps its confirmation', async () => {
    const kv = createMemoryKv();
    const { ports, users, calls } = fakeAuth({ u1: { email: 'ada@example.com', verified: true } });
    expect(await attachEmail(kv, ports, 'u1', 'ada@example.com', NOW)).toEqual({
      ok: true,
      email: 'ada@example.com',
      verified: true,
    });
    expect(calls).toEqual([]);
    expect(users.get('u1')?.verified).toBe(true);
    expect(await emailLoginUser(kv, 'ada@example.com')).toBe('u1');
  });
});

describe('emailStatus and sign-in by email', () => {
  it('opens the sign-in only after Auth reports the address confirmed', async () => {
    const kv = createMemoryKv();
    const { ports, users } = fakeAuth();
    await attachEmail(kv, ports, 'u1', 'ada@example.com', NOW);
    expect(await emailStatus(kv, ports, 'u1', NOW)).toEqual({
      email: 'ada@example.com',
      verified: false,
    });
    expect(await emailLoginUser(kv, 'ada@example.com')).toBeNull();
    users.set('u1', { email: 'ada@example.com', verified: true });
    expect(await emailStatus(kv, ports, 'u1', NOW + 5)).toEqual({
      email: 'ada@example.com',
      verified: true,
    });
    expect(await emailLoginUser(kv, ' ADA@example.com ')).toBe('u1');
  });

  it('an unknown, malformed or other account address gives the same null', async () => {
    const kv = createMemoryKv();
    expect(await emailLoginUser(kv, 'ghost@example.com')).toBeNull();
    expect(await emailLoginUser(kv, 'not-an-email@')).toBeNull();
  });

  it('a status without an email reports none and writes nothing', async () => {
    const kv = createMemoryKv();
    const { ports } = fakeAuth();
    expect(await emailStatus(kv, ports, 'u1', NOW)).toEqual({ email: null, verified: false });
    expect(kv.paths()).toEqual([]);
  });
});

describe('a failed Auth write', () => {
  it('puts the old confirmed address back exactly as it was and frees the new one', async () => {
    const kv = createMemoryKv();
    const { ports, users } = fakeAuth({ u1: { email: 'old@example.com', verified: true } }, [
      'new@example.com',
    ]);
    await kv.set('emails/old%40example.com', { userId: 'u1', verifiedAt: 7, updatedAt: 7 });
    expect(await attachEmail(kv, ports, 'u1', 'new@example.com', NOW)).toEqual({
      ok: false,
      reason: 'taken',
    });
    expect(await kv.get('emails/old%40example.com')).toEqual({
      userId: 'u1',
      verifiedAt: 7,
      updatedAt: 7,
    });
    expect(kv.has('emails/new%40example.com')).toBe(false);
    expect(users.get('u1')).toEqual({ email: 'old@example.com', verified: true });
    expect(await emailLoginUser(kv, 'old@example.com')).toBe('u1');
  });

  it('rethrows an unexpected Auth error and still rolls the reservation back', async () => {
    const kv = createMemoryKv();
    const ports: AttachPorts = {
      current: async () => ({ email: null, verified: false }),
      setEmail: async () => Promise.reject(new Error('boom')),
    };
    await expect(attachEmail(kv, ports, 'u1', 'ada@example.com', NOW)).rejects.toThrow('boom');
    expect(kv.paths()).toEqual([]);
  });
});
