import { beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  coachAccept,
  coachInvite,
  coachRead,
  setConsent,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import { DAY } from '../../functions/src/coach/logic';

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);
const trainer: Actor = { uid: 't1', role: 'trainer' };
const client: Actor = { uid: 'c1', role: 'member' };

let kv: MemoryKv;
let t = T0;
const PEPPER = randomBytes(32);
let n = 0;
const ctx = (): Ctx => ({
  kv,
  now: () => t,
  pepper: PEPPER,
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
  notify: async () => undefined,
});

async function link(consent: Record<string, string>) {
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Iryna' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    trainerId: null,
  });
  const inv = await coachInvite(ctx(), trainer, {
    name: 'Oleh',
    mode: 'app',
    request: { totals: 'full' },
  });
  await coachAccept(ctx(), client, { token: inv.inviteId, consent });
}
const workout = (id: string, startedAt: number, updatedAt?: number, extra = {}) =>
  kv.set(`users/c1/workouts/${id}`, {
    startedAt,
    finishedAt: startedAt + 3_600_000,
    stats: { volumeKg: 1000, sets: 5 },
    enc: { v: 1, ct: `CT-${id}` },
    ...(updatedAt === undefined ? {} : { updatedAt }),
    ...extra,
  });
const read = (cats: string[], extra: Record<string, unknown> = {}) =>
  coachRead(ctx(), trainer, { clientId: 'c1', categories: cats, ...extra });
const audits = async () =>
  (await kv.list('users/c1/audit')).map((r) => [r.data.category, r.data.count]);

beforeEach(async () => {
  kv = createMemoryKv();
  t = T0;
  n = 0;
  await link({ totals: 'full', sets: 'full' });
  await workout('w1', T0 - 3 * DAY, T0 - 3 * DAY + 10);
  await workout('w2', T0 - 2 * DAY, T0 - 2 * DAY + 20);
  await workout('w3', T0 - DAY, T0 - DAY + 30);
});

describe('coachRead changedSince: delta with an integrity token', () => {
  it('without changedSince the response has no delta fields at all (old clients)', async () => {
    const r = await read(['totals', 'sets']);
    expect(r.results.totals).not.toHaveProperty('delta');
    expect(r.results.totals).not.toHaveProperty('token');
    expect(r.results.sets).not.toHaveProperty('delta');
  });

  it('changedSince 0 returns every workout as a delta, with updatedAt on totals and a token', async () => {
    const r = await read(['totals', 'sets'], { changedSince: 0 });
    const tot = r.results.totals;
    expect(tot).toMatchObject({ state: 'ok', level: 'full', delta: true });
    expect(tot.docs!.map((d) => d.id).sort()).toEqual(['w1', 'w2', 'w3']);
    expect(tot.docs!.every((d) => typeof d.updatedAt === 'number')).toBe(true);
    expect(tot.token).toEqual({ count: 3, sum: 3 * T0 - 6 * DAY + 60 });
    expect(r.results.sets).toMatchObject({ delta: true, token: tot.token });
    expect(JSON.stringify(tot)).not.toMatch(/CT-|"enc"/);
  });

  it('returns only workouts changed since, and still the token of the whole window', async () => {
    const full = await read(['sets'], { changedSince: 0 });
    await workout('w2', T0 - 2 * DAY, T0 + 500); // edited
    await workout('w4', T0 - 100, T0 + 600); // added
    const d = await read(['sets'], { changedSince: T0 });
    expect(d.results.sets.delta).toBe(true);
    expect(d.results.sets.docs!.map((x) => x.id).sort()).toEqual(['w2', 'w4']);
    expect(d.results.sets.token!.count).toBe(4);
    expect(d.results.sets.token!.sum).not.toBe(full.results.sets.token!.sum);
  });

  it('a delta read is audited like any read (once per category per call)', async () => {
    await read(['totals', 'sets'], { changedSince: 0 });
    await read(['totals', 'sets'], { changedSince: T0 });
    expect(await audits()).toEqual(
      expect.arrayContaining([
        ['totals', 2],
        ['sets', 2],
      ]),
    );
  });

  it('a legacy workout without updatedAt forces delta:false and a normal full read', async () => {
    await workout('old', T0 - 9 * DAY); // no updatedAt
    const r = await read(['totals', 'sets'], { changedSince: T0 });
    expect(r.results.totals.delta).toBe(false);
    expect(r.results.totals).not.toHaveProperty('token');
    expect(r.results.totals.docs).toHaveLength(4);
    expect(r.results.totals.docs!.every((d) => !('updatedAt' in d))).toBe(true);
    expect(r.results.sets.delta).toBe(false);
    expect(r.results.sets.docs).toHaveLength(4);
  });

  it('a workout without startedAt, or a non-numeric updatedAt, forces delta:false', async () => {
    await kv.set('users/c1/workouts/odd', { updatedAt: T0, enc: { v: 1, ct: 'x' } });
    expect((await read(['sets'], { changedSince: 0 })).results.sets.delta).toBe(false);
    await kv.del('users/c1/workouts/odd');
    await workout('str', T0 - 5, undefined, { updatedAt: 'yesterday' });
    expect((await read(['sets'], { changedSince: 0 })).results.sets.delta).toBe(false);
  });

  it('more workouts than the full read returns forces delta:false (the window would be cut)', async () => {
    for (let i = 0; i < 200; i++) await workout(`b${i}`, T0 - 10 * DAY - i, T0 + i);
    const sets = await read(['sets'], { changedSince: 0 });
    expect(sets.results.sets.delta).toBe(false);
    expect(sets.results.sets.docs).toHaveLength(200);
    const totals = await read(['totals'], { changedSince: 0 });
    expect(totals.results.totals.delta).toBe(true); // 203 <= 400
  });

  it('is ignored below full consent (effects returns its derived view / share, delta:false) and when `since` is used', async () => {
    await setConsent(ctx(), client, { category: 'totals', level: 'effects' });
    const r = await read(['totals'], { changedSince: 0 });
    expect(r.results.totals).toMatchObject({ level: 'effects', delta: false });
    expect(r.results.totals.view).toBeDefined();
    const s = await read(['sets'], { changedSince: 0, since: T0 - 2 * DAY });
    expect(s.results.sets.delta).toBe(false);
    expect(s.results.sets.docs!.map((d) => d.id).sort()).toEqual(['w2', 'w3']);
  });

  it('rejects nothing for a bad changedSince: it is simply not a delta request', async () => {
    for (const bad of ['5', -1, NaN, null, {}]) {
      const r = await read(['sets'], { changedSince: bad });
      expect(r.results.sets).not.toHaveProperty('delta');
      expect(r.results.sets.docs).toHaveLength(3);
    }
  });

  it('other categories are untouched', async () => {
    const r = await read(['injury', 'sets'], { changedSince: 0 });
    expect(r.results.injury).not.toHaveProperty('delta');
  });
});
