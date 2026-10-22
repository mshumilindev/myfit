import { describe, expect, it } from 'vitest';
import { createMemoryKv } from '../functions/src/coach/memoryKv';
import {
  THROTTLE_MAX,
  THROTTLE_WINDOW_MS,
  recordConsentHandler,
} from '../functions/src/consentRecordsCore';

const V = '2026-10-21';
/** atlas-ai was re-released with a wider text (SPO-286): its grants carry the newer version. */
const V_AI = '2026-10-22';
const HASH = 'c'.repeat(64);
const NOW = 1_800_000_000_000;
let n = 0;
const rand = () => `r${n++}`;

async function setup(user: Record<string, unknown> | null = { role: 'member', status: 'active' }) {
  const kv = createMemoryKv();
  if (user) await kv.set('users/u1', user);
  const call = (data: unknown, o: { uid?: string | null; now?: number } = {}) =>
    recordConsentHandler(kv, {
      uid: o.uid === null ? undefined : (o.uid ?? 'u1'),
      data,
      now: o.now ?? NOW,
      rand,
    });
  const stored = async () => kv.list('users/u1/consentRecords');
  return { kv, call, stored };
}
const fail = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as { code: string; message: string }).code + ':' + (e as Error).message;
  }
  return 'ok';
};
const terms = { kind: 'terms', action: 'grant', version: V, textHash: HASH };

describe('recordConsent handler', () => {
  it('refuses a signed-out caller and writes nothing', async () => {
    const { call, stored } = await setup();
    expect(await fail(call(terms, { uid: null }))).toMatch(/^unauthenticated/);
    expect(await stored()).toHaveLength(0);
  });

  it('refuses bad input with invalid-argument and the reason code', async () => {
    const { call, stored } = await setup();
    expect(await fail(call({ ...terms, kind: 'marketing' }))).toBe('invalid-argument:bad-kind');
    expect(await fail(call({ ...terms, extra: 1 }))).toBe('invalid-argument:bad-input');
    expect(await fail(call({ ...terms, textHash: undefined }))).toBe(
      'invalid-argument:bad-textHash',
    );
    expect(await fail(call(null))).toBe('invalid-argument:bad-input');
    expect(await stored()).toHaveLength(0);
  });

  it('version allow-list: a stale or invented grant version is refused, even with a valid shape', async () => {
    const { call, stored } = await setup();
    expect(await fail(call({ ...terms, version: '2020-01-01' }))).toBe(
      'invalid-argument:stale-version',
    );
    expect(await fail(call({ ...terms, version: '2099-12-31' }))).toBe(
      'invalid-argument:stale-version',
    );
    expect(await stored()).toHaveLength(0);
  });

  it('refuses a deleted account (no user document) and a suspended one', async () => {
    const gone = await setup(null);
    expect(await fail(gone.call(terms))).toMatch(/^not-found/);
    expect(await gone.stored()).toHaveLength(0);
    const sus = await setup({ role: 'member', status: 'suspended' });
    expect(await fail(sus.call(terms))).toMatch(/^permission-denied/);
    expect(await sus.stored()).toHaveLength(0);
  });

  it('stores the record with the server time and an id that does not name the kind', async () => {
    const { call, stored } = await setup();
    const r = await call({ kind: 'health:cycle', action: 'grant', version: V });
    expect(r.at).toBe(NOW);
    expect(r.id).not.toMatch(/cycle|health/);
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({ kind: 'health:cycle', action: 'grant', at: NOW });
  });

  it('is idempotent: repeating the same grant returns the existing record and writes nothing', async () => {
    const { call, stored } = await setup();
    const a = await call(terms);
    const b = await call(terms, { now: NOW + 5000 });
    expect(b).toEqual(a);
    expect(await stored()).toHaveLength(1);
    // a withdrawal then a repeat of it is a no-op too, but grant after withdraw is a new record
    const w = await call({ kind: 'terms', action: 'withdraw', version: V }, { now: NOW + 6000 });
    expect(
      await call({ kind: 'terms', action: 'withdraw', version: V }, { now: NOW + 7000 }),
    ).toEqual(w);
    await call(terms, { now: NOW + 8000 });
    expect(await stored()).toHaveLength(3);
  });

  it('different categories or engines are a new record', async () => {
    const { call, stored } = await setup();
    const g = { kind: 'atlas-ai', action: 'grant', version: V_AI };
    await call({ ...g, categories: ['workouts'] });
    await call({ ...g, categories: ['workouts', 'sleep'] }, { now: NOW + 1000 });
    await call({ ...g, categories: ['sleep', 'workouts'] }, { now: NOW + 2000 }); // same set: no-op
    expect(await stored()).toHaveLength(2);
  });

  it('keeps `at` strictly increasing per kind even when the clock is behind or equal', async () => {
    const { call } = await setup();
    const a = await call(terms, { now: NOW });
    const w = await call({ kind: 'terms', action: 'withdraw', version: V }, { now: NOW }); // same ms
    const g = await call(terms, { now: NOW - 10_000 }); // clock went back
    expect(w.at).toBe(a.at + 1);
    expect(g.at).toBe(w.at + 1);
  });

  it('throttles new records per person, per window; no-ops and other people are unaffected', async () => {
    const { kv, call, stored } = await setup();
    await kv.set('users/u2', { role: 'member', status: 'active' });
    const g = (i: number) => ({
      kind: 'atlas-ai',
      action: 'grant',
      version: V_AI,
      categories: [`c${i}`],
    });
    for (let i = 0; i < THROTTLE_MAX; i++) await call(g(i), { now: NOW + i });
    expect(await stored()).toHaveLength(THROTTLE_MAX);
    expect(await fail(call(g(99), { now: NOW + 100 }))).toMatch(/^resource-exhausted/);
    expect(await stored()).toHaveLength(THROTTLE_MAX);
    // repeating the latest write is a no-op and still succeeds under the throttle
    expect(await fail(call(g(THROTTLE_MAX - 1), { now: NOW + 200 }))).toBe('ok');
    // another person is independent
    await expect(
      recordConsentHandler(kv, { uid: 'u2', data: terms, now: NOW + 200, rand }),
    ).resolves.toBeTruthy();
    // the window passes
    expect(await fail(call(g(99), { now: NOW + THROTTLE_MAX + THROTTLE_WINDOW_MS + 1 }))).toBe(
      'ok',
    );
  });
});
