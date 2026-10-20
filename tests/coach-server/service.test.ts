import { beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomBytes, verify as edVerify, sign as edSign } from 'node:crypto';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  CoachError,
  afterMessageCreated,
  chatResetKey,
  coachAccept,
  coachDecline,
  coachEnd,
  coachInvite,
  coachInviteRevoke,
  coachKeySign,
  coachMyLink,
  coachKeySigPayload,
  coachRead,
  coachRoster,
  invitePreview,
  logRead,
  publishPlanVersion,
  publishSignKey,
  signKeySigPayload,
  onCoachKeyChanged,
  onConversationKey,
  recomputeConversation,
  rescheduleCreate,
  rescheduleRespond,
  programAck,
  setCoachingMode,
  setConsent,
  sweep,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import { ALL_OFF, DAY, conversationId, keyFingerprint } from '../../functions/src/coach/logic';
import { inviteTokenOf } from '../../functions/src/coach/inviteLink';

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);
const PEPPER = randomBytes(32);
const trainer: Actor = { uid: 't1', role: 'trainer' };
const admin: Actor = { uid: 'a1', role: 'admin' };
const client: Actor = { uid: 'c1', role: 'member' };
const other: Actor = { uid: 'c2', role: 'member' };

let kv: MemoryKv;
let t = T0;
let n = 0;
let pushes: [string, string][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => t,
  pepper: PEPPER,
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
  notify: async (uid, kind) => void pushes.push([uid, kind]),
});
const CID = conversationId(PEPPER, 'c1', 't1');

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof CoachError) return `${e.code}:${e.reason}`;
    throw e;
  }
  return 'ok';
}

async function seedUsers() {
  await kv.set('users/t1', {
    role: 'trainer',
    status: 'active',
    firstName: 'Iryna',
    lastName: null,
    username: 'iryna',
  });
  await kv.set('users/a1', { role: 'admin', status: 'active', firstName: 'Ada', username: 'ada' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    username: 'oleh',
    trainerId: null,
  });
  await kv.set('users/c2', {
    role: 'member',
    status: 'active',
    firstName: 'Maria',
    username: 'maria',
    trainerId: null,
  });
  await kv.set('usernames/oleh', { userId: 'c1' });
  await kv.set('usernames/maria', { userId: 'c2' });
}
/** Invite + accept through the real services. */
async function link(
  consent?: Record<string, string>,
  mode: 'app' | 'hybrid' | 'program' = 'app',
  actor = client,
  trainerActor = trainer,
) {
  const inv = await coachInvite(ctx(), trainerActor, {
    name: 'Oleh',
    mode,
    request: { totals: 'full' },
    ...(mode === 'program' ? { username: 'oleh' } : {}),
  });
  return coachAccept(ctx(), actor, { token: inv.inviteId, consent });
}

beforeEach(async () => {
  kv = createMemoryKv();
  t = T0;
  n = 0;
  pushes = [];
  await seedUsers();
});

describe('invite -> preview -> accept (R-BE-REL-1..4)', () => {
  it('creates a link invite that never grants access and previews only what the screen needs', async () => {
    const r = await coachInvite(ctx(), trainer, {
      name: ' Oleh  K ',
      mode: 'app',
      request: { totals: 'full', sets: 'full' },
    });
    expect(r.url).toBe(`https://spotter-64c3b.web.app/#/invite/${r.inviteId}`);
    expect(inviteTokenOf(r.url)).toBe(r.inviteId);
    expect(r.expiresAt).toBe(T0 + 7 * DAY);
    expect(await kv.get('coaching/c1')).toBeNull();
    const anon = await invitePreview(ctx(), r.inviteId, null);
    expect(anon).toEqual({
      kind: 'link',
      trainerName: 'Iryna',
      mode: 'app',
      expiresAt: T0 + 7 * DAY,
      problem: null,
    });
    const signed = await invitePreview(ctx(), r.inviteId, client);
    expect(signed).toMatchObject({ request: { totals: 'full', sets: 'full', body: 'off' } });
    expect(await invitePreview(ctx(), 'nope', null)).toEqual({
      kind: 'link',
      problem: 'wrong-kind',
    });
  });
  it('only a coach can invite; name, mode and request are validated', async () => {
    expect(await code(coachInvite(ctx(), client, { name: 'Oleh', mode: 'app' }))).toBe(
      'permission-denied:not-a-coach',
    );
    expect(await code(coachInvite(ctx(), trainer, { name: 'O', mode: 'app' }))).toBe(
      'invalid-argument:invalid-name',
    );
    expect(await code(coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'x' }))).toBe(
      'invalid-argument:invalid-mode',
    );
    expect(
      await code(
        coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app', request: { sets: 'max' } }),
      ),
    ).toBe('invalid-argument:invalid-request');
  });
  it('accept with no choice leaves every level off and creates coaching, conversation, notices (R-BE-REL-3)', async () => {
    const res = await link();
    expect(res.cid).toBe(CID);
    expect(res.consent).toEqual(ALL_OFF);
    expect(await kv.get('coaching/c1')).toMatchObject({
      status: 'active',
      trainerId: 't1',
      mode: 'app',
      consentVersion: 1,
      keyEpoch: 1,
    });
    expect((await kv.get('users/c1'))?.trainerId).toBe('t1');
    expect(await kv.get(`conversations/${CID}`)).toMatchObject({
      clientId: 'c1',
      trainerId: 't1',
      active: true,
      readUpTo: {},
      clearedBefore: {},
    });
    expect(kv.has('users/t1/notices/ca-tok000000000001')).toBe(true);
    expect(kv.has('users/c1/notices/ta-tok000000000001')).toBe(true);
    // the notice texts read `detail` (the OTHER side's name): it must never be null ("null is now your trainer")
    expect((await kv.get('users/c1/notices/ta-tok000000000001'))?.detail).toBeTruthy();
    expect((await kv.get('users/t1/notices/ca-tok000000000001'))?.detail).toBeTruthy();
    expect(await kv.list('users/c1/consentLog')).toHaveLength(0);
  });
  it('accept applies the client own choice and logs each change', async () => {
    const res = await link({ totals: 'full', sets: 'effects' });
    expect(res.consent).toMatchObject({ totals: 'full', sets: 'effects', injury: 'off' });
    expect((await kv.list('users/c1/consentLog')).map((r) => r.data.category).sort()).toEqual([
      'sets',
      'totals',
    ]);
  });
  it('the invite is single use; a second trainer cannot take an already coached client; a bad choice is refused', async () => {
    const inv = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    expect(
      await code(coachAccept(ctx(), client, { token: inv.inviteId, consent: { sets: 'x' } })),
    ).toBe('invalid-argument:invalid-consent');
    await coachAccept(ctx(), client, { token: inv.inviteId });
    expect(await code(coachAccept(ctx(), client, { token: inv.inviteId }))).toBe(
      'failed-precondition:claimed',
    );
    expect(await code(coachAccept(ctx(), other, { token: inv.inviteId }))).toBe(
      'failed-precondition:claimed',
    );
    const inv2 = await coachInvite(ctx(), admin, { name: 'Oleh', mode: 'app' });
    expect(await code(coachAccept(ctx(), client, { token: inv2.inviteId }))).toBe(
      'failed-precondition:already-has-trainer',
    );
  });
  it('expired, revoked and declined links fail with a reason code; targeted invites are for that user only', async () => {
    const a = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    t = T0 + 8 * DAY;
    expect(await code(coachAccept(ctx(), client, { token: a.inviteId }))).toBe(
      'failed-precondition:expired',
    );
    t = T0;
    const b = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    await coachInviteRevoke(ctx(), trainer, { inviteId: b.inviteId });
    expect(await code(coachAccept(ctx(), client, { token: b.inviteId }))).toBe(
      'failed-precondition:revoked',
    );
    const c = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    await coachDecline(ctx(), client, { token: c.inviteId });
    expect(await code(coachAccept(ctx(), client, { token: c.inviteId }))).toBe(
      'failed-precondition:revoked',
    );
    const d = await coachInvite(ctx(), trainer, { name: 'Maria', mode: 'app', username: 'Maria' });
    expect(pushes).toContainEqual(['c2', 'invite']);
    expect(await code(coachAccept(ctx(), client, { token: d.inviteId }))).toBe(
      'failed-precondition:not-for-you',
    );
    expect(await code(coachDecline(ctx(), client, { token: d.inviteId }))).toBe(
      'permission-denied:not-for-you',
    );
    await coachAccept(ctx(), other, { token: d.inviteId });
  });
  it('only the owner (or an admin) revokes; a claimed invite cannot be revoked; nobody coaches themselves', async () => {
    const a = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    expect(await code(coachInviteRevoke(ctx(), admin, { inviteId: a.inviteId }))).toBe('ok');
    const b = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    expect(
      await code(
        coachInviteRevoke(ctx(), { uid: 't9', role: 'trainer' }, { inviteId: b.inviteId }),
      ),
    ).toBe('permission-denied:not-your-invite');
    await coachAccept(ctx(), client, { token: b.inviteId });
    expect(await code(coachInviteRevoke(ctx(), trainer, { inviteId: b.inviteId }))).toBe(
      'failed-precondition:claimed',
    );
    await kv.set('usernames/iryna', { userId: 't1' });
    expect(
      await code(coachInvite(ctx(), trainer, { name: 'Iryna', mode: 'app', username: 'iryna' })),
    ).toBe('invalid-argument:cannot-coach-yourself');
    const self = await coachInvite(ctx(), client as Actor & { role: 'trainer' }, {
      name: 'Oleh',
      mode: 'app',
    }).catch(() => null);
    expect(self).toBeNull();
  });
  it('enforces 20 invites per day', async () => {
    for (let i = 0; i < 20; i++)
      await coachInvite(ctx(), trainer, { name: `Person ${i}`, mode: 'app' });
    expect(await code(coachInvite(ctx(), trainer, { name: 'One more', mode: 'app' }))).toBe(
      'resource-exhausted:too-many-today',
    );
  });
  it('a program-only client without an account is added at once, all off, with no link', async () => {
    const r = await coachInvite(ctx(), trainer, {
      name: 'Denys',
      mode: 'program',
      request: { sets: 'full' },
    });
    expect(r.url).toBeNull();
    expect(r.clientId).toMatch(/^pc-/);
    expect(await kv.get(`coaching/${r.clientId}`)).toMatchObject({
      status: 'active',
      mode: 'program',
      consent: ALL_OFF,
    });
  });
  it('the roster tells whether a client has a photo (and its revision), and exposes nothing else', async () => {
    await link();
    let r = await coachRoster(ctx(), trainer);
    expect(r.clients[0]).toMatchObject({ clientId: 'c1', avatar: false, avatarRev: 0 });
    // the client uploaded a photo: the app records avatarExt on its profile (updatedAt = revision)
    await kv.merge('users/c1', { avatarExt: 'jpg', updatedAt: 1234 });
    r = await coachRoster(ctx(), trainer);
    expect(r.clients[0]).toMatchObject({ avatar: true, avatarRev: 1234 });
    // the Storage rule lets the trainer read avatars/{uid}/photo through users.trainerId: linking must set it
    expect(await kv.get('users/c1')).toMatchObject({ trainerId: 't1' });
    // photo removed again
    await kv.merge('users/c1', { avatarExt: null, updatedAt: 1300 });
    r = await coachRoster(ctx(), trainer);
    expect(r.clients[0]).toMatchObject({ avatar: false, avatarRev: 0 });
  });
  it('a client without the app (program-only, no user record) never has a photo', async () => {
    await link();
    const made = await coachInvite(ctx(), trainer, { name: 'Denys', mode: 'program' });
    expect(made.url).toBeNull();
    const r = await coachRoster(ctx(), trainer);
    const denys = r.clients.find((c) => c.clientId === made.clientId);
    expect(denys).toMatchObject({ avatar: false, avatarRev: 0 });
  });
  it('the roster lists clients and pending invites for the trainer only', async () => {
    await link();
    const pend = await coachInvite(ctx(), trainer, { name: 'Maria', mode: 'hybrid' });
    const r = await coachRoster(ctx(), trainer);
    expect(r.clients.map((c) => [c.clientId, c.name, c.cid])).toEqual([['c1', 'Oleh', CID]]);
    expect(r.invites.map((i) => i.inviteId)).toEqual([pend.inviteId]);
    expect((await coachRoster(ctx(), admin)).clients).toHaveLength(0);
    expect(await code(coachRoster(ctx(), client))).toBe('permission-denied:not-a-coach');
  });
});

describe('coachRead: one consent-gated path with an audit entry per day (R-BE-CON-2/3, R-BE-AUD-1)', () => {
  async function seedData() {
    await kv.set('users/c1/workouts/w1', {
      startedAt: T0 - DAY,
      finishedAt: T0 - DAY + 3_600_000,
      stats: { volumeKg: 5000, sets: 20 },
      enc: { v: 1, ct: 'SEALED-SETS' },
      exercises: 'LEAK-EXERCISES',
    });
    await kv.set('users/c1/workouts/w2', {
      startedAt: T0 - 8 * DAY,
      finishedAt: T0 - 8 * DAY + 1_800_000,
      stats: { volumeKg: 3000, sets: 10 },
      enc: { v: 1, ct: 'SEALED-2' },
    });
    await kv.set('users/c1/shares/sets', {
      category: 'sets',
      level: 'effects',
      asOf: 1,
      v: 1,
      enc: { ct: 'VIEW' },
    });
    await kv.set('users/c1/sleeps/s1', { date: '2026-10-09', enc: { ct: 'SLEEP' } });
  }
  it('totals full returns open fields only: no enc, no exercises', async () => {
    await link({ totals: 'full' });
    await seedData();
    const r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/SEALED|LEAK|"enc"|exercises/);
    expect(r.results.totals).toMatchObject({ state: 'ok', level: 'full' });
    expect(r.results.totals.docs).toHaveLength(2);
  });
  it('hands over the trainer grant only when a sealed category is returned', async () => {
    await link({ totals: 'full', sets: 'full' });
    await seedData();
    await kv.set('users/c1/grants/t1', { v: 1, ct: 'GRANTCT', fp: 'f' });
    await kv.set('users/c1/grants/t2', { v: 1, ct: 'OTHERCOACH', fp: 'f' });
    const totalsOnly = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] });
    expect(totalsOnly.grant).toBeNull();
    const sets = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['sets'] });
    expect(sets.grant).toMatchObject({ ct: 'GRANTCT' });
    expect(JSON.stringify(sets)).not.toContain('OTHERCOACH');
  });
  it('totals full also returns the sealed activity view and the grant; effects never does; a downgrade removes it', async () => {
    await link({ totals: 'full' });
    await seedData();
    await kv.set('users/c1/shares/totals', {
      category: 'totals',
      level: 'full',
      asOf: 1,
      v: 1,
      enc: { ct: 'ACTIVITIES' },
    });
    await kv.set('users/c1/grants/t1', { v: 1, ct: 'GRANTCT', fp: 'f' });
    let r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] });
    expect(r.results.totals.extras).toHaveLength(1);
    expect(JSON.stringify(r.results.totals.extras)).toContain('ACTIVITIES');
    expect(r.grant).toMatchObject({ ct: 'GRANTCT' });
    // totals at effects: weekly numbers only, even if a stale activity doc is still there
    await kv.set('users/c1/shares/totals', { category: 'totals', enc: { ct: 'ACTIVITIES' } });
    await setConsent(ctx(), client, { category: 'totals', level: 'effects' });
    expect(await kv.get('users/c1/shares/totals')).toBeNull();
    await kv.set('users/c1/shares/totals', { category: 'totals', enc: { ct: 'ACTIVITIES' } });
    r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] });
    expect(JSON.stringify(r)).not.toContain('ACTIVITIES');
    expect(r.grant).toBeNull();
    // off: gone and locked
    await setConsent(ctx(), client, { category: 'totals', level: 'off' });
    expect(await kv.get('users/c1/shares/totals')).toBeNull();
  });
  it('totals effects returns weekly totals, not sessions', async () => {
    await link({ totals: 'effects' });
    await seedData();
    const r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] });
    expect(r.results.totals.docs).toBeUndefined();
    expect(r.results.totals.view).toMatchObject({
      lastSessionAt: T0 - DAY,
      weeks: expect.any(Array),
    });
  });
  it('sets: off locked with NO data; effects the share doc only; full the sealed workouts', async () => {
    await link({ totals: 'full' });
    await seedData();
    let r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals', 'sets'] });
    expect(r.results.sets).toEqual({ state: 'locked' });
    expect(JSON.stringify(r.results.sets)).not.toMatch(/SEALED|VIEW/);
    await setConsent(ctx(), client, { category: 'sets', level: 'effects' });
    r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['sets'] });
    expect(JSON.stringify(r.results.sets)).toContain('VIEW');
    expect(JSON.stringify(r.results.sets)).not.toContain('SEALED');
    await setConsent(ctx(), client, { category: 'sets', level: 'full' });
    r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['sets'] });
    expect(JSON.stringify(r.results.sets)).toContain('SEALED-SETS');
  });
  it('returns only requested categories, validates input, and refuses other trainers, clients and ended links', async () => {
    await link({ totals: 'full', sleep: 'full' });
    await seedData();
    const r = await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['sleep'] });
    expect(Object.keys(r.results)).toEqual(['sleep']);
    expect(JSON.stringify(r)).toContain('SLEEP');
    expect(await code(coachRead(ctx(), trainer, { clientId: 'c1', categories: [] }))).toBe(
      'invalid-argument:invalid-categories',
    );
    expect(await code(coachRead(ctx(), trainer, { clientId: 'c1', categories: ['photos'] }))).toBe(
      'invalid-argument:invalid-categories',
    );
    expect(
      await code(
        coachRead(
          ctx(),
          { uid: 't9', role: 'trainer' },
          { clientId: 'c1', categories: ['totals'] },
        ),
      ),
    ).toBe('permission-denied:not-your-client');
    expect(await code(coachRead(ctx(), client, { clientId: 'c1', categories: ['totals'] }))).toBe(
      'permission-denied:not-your-client',
    );
    await coachEnd(ctx(), client, { clientId: 'c1' });
    expect(await code(coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] }))).toBe(
      'permission-denied:not-active',
    );
  });
  it('program mode: every category is not-applicable and nothing is read or audited', async () => {
    await link(undefined, 'program');
    await seedData();
    const r = await coachRead(ctx(), trainer, {
      clientId: 'c1',
      categories: ['totals', 'sets', 'injury'],
    });
    expect(Object.values(r.results).every((x) => x.state === 'not-applicable')).toBe(true);
    expect(await kv.list('users/c1/audit')).toHaveLength(0);
  });
  it('five reads on one day are ONE audit entry with count 5; another via or another day is a new entry', async () => {
    await link({ totals: 'full' });
    await seedData();
    for (let i = 0; i < 5; i++) {
      t += 60_000;
      await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'], via: 'client360' });
    }
    let a = await kv.list('users/c1/audit');
    expect(a).toHaveLength(1);
    expect(a[0].data).toMatchObject({
      count: 5,
      readerId: 't1',
      readerName: 'Iryna',
      readerRole: 'trainer',
      subjectId: 'c1',
      category: 'totals',
      level: 'full',
      via: 'client360',
      at: T0 + 60_000,
      lastAt: T0 + 300_000,
    });
    await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'], via: 'queue' });
    t += DAY;
    await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'], via: 'client360' });
    a = await kv.list('users/c1/audit');
    expect(a).toHaveLength(3);
  });
  it('locked categories are not audited; logRead audits exports and ignores locked ones', async () => {
    await link({ totals: 'full' });
    await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['sets'] });
    expect(await kv.list('users/c1/audit')).toHaveLength(0);
    await logRead(ctx(), trainer, { clientId: 'c1', category: 'totals', via: 'export' });
    await logRead(ctx(), trainer, { clientId: 'c1', category: 'sets', via: 'export' });
    const a = await kv.list('users/c1/audit');
    expect(a).toHaveLength(1);
    expect(a[0].data).toMatchObject({ via: 'export', category: 'totals' });
    expect(await code(logRead(ctx(), trainer, { clientId: 'c1', category: 'x' }))).toBe(
      'invalid-argument:invalid-category',
    );
  });
  it('an admin coaches only their own clients, with the same consent', async () => {
    await link({ totals: 'full' }, 'app', client, admin);
    expect(await code(coachRead(ctx(), admin, { clientId: 'c1', categories: ['totals'] }))).toBe(
      'ok',
    );
    await kv.set('coaching/c2', {
      clientId: 'c2',
      trainerId: 't1',
      status: 'active',
      mode: 'app',
      consent: ALL_OFF,
      consentVersion: 1,
      keyEpoch: 1,
    });
    expect(await code(coachRead(ctx(), admin, { clientId: 'c2', categories: ['totals'] }))).toBe(
      'permission-denied:not-your-client',
    );
  });
});

describe('consent changes, mode, ending (R-BE-CON-1/6, R-BE-REL-6/7, R-BE-DEC-9)', () => {
  async function evidence() {
    await kv.set('users/t1/decisions/d1', {
      id: 'd1',
      clientId: 'c1',
      kind: 'stall',
      status: 'sent',
      decidedAt: 1,
    });
    await kv.set('users/t1/decisions/d1/evidence/sets', { category: 'sets', enc: { ct: 'E1' } });
    await kv.set('users/t1/decisions/d1/evidence/totals', {
      category: 'totals',
      enc: { ct: 'E2' },
    });
    await kv.set('users/t1/decisions/d2', {
      id: 'd2',
      clientId: 'c2',
      kind: 'stall',
      status: 'sent',
      decidedAt: 1,
    });
    await kv.set('users/t1/decisions/d2/evidence/sets', {
      category: 'sets',
      enc: { ct: 'OTHERCLIENT' },
    });
    await kv.set('users/c1/shares/sets', {
      category: 'sets',
      level: 'effects',
      asOf: 1,
      v: 1,
      enc: { ct: 'V' },
    });
  }
  it('every transition bumps the version once, writes one log entry per change and is idempotent', async () => {
    await link();
    const levels = ['off', 'effects', 'full'] as const;
    let version = 1;
    for (const from of levels)
      for (const to of levels) {
        await setConsent(ctx(), client, { category: 'body', level: from });
        const before = (await kv.get('coaching/c1'))?.consentVersion as number;
        t += 1000;
        const r = await setConsent(ctx(), client, { category: 'body', level: to });
        const after = (await kv.get('coaching/c1'))?.consentVersion as number;
        expect(after).toBe(from === to ? before : before + 1);
        expect(r.consent.body).toBe(to);
        version = after;
      }
    expect(version).toBeGreaterThan(1);
  });
  it('a downgrade to off deletes the derived share and the trainer evidence of THAT client and category only', async () => {
    await link({ sets: 'full', totals: 'full' });
    await evidence();
    await setConsent(ctx(), client, { category: 'sets', level: 'off' });
    expect(kv.has('users/c1/shares/sets')).toBe(false);
    expect(kv.has('users/t1/decisions/d1/evidence/sets')).toBe(false);
    expect(kv.has('users/t1/decisions/d1/evidence/totals')).toBe(true);
    expect(kv.has('users/t1/decisions/d2/evidence/sets')).toBe(true);
    expect(
      (await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['sets'] })).results.sets,
    ).toEqual({ state: 'locked' });
  });
  it('a downgrade to effects drops the granular evidence but keeps the share; an upgrade deletes nothing', async () => {
    await link({ sets: 'full' });
    await evidence();
    await setConsent(ctx(), client, { category: 'sets', level: 'effects' });
    expect(kv.has('users/t1/decisions/d1/evidence/sets')).toBe(false);
    expect(kv.has('users/c1/shares/sets')).toBe(true);
    await evidence();
    await setConsent(ctx(), client, { category: 'sets', level: 'full' });
    expect(kv.has('users/t1/decisions/d1/evidence/sets')).toBe(true);
  });
  it('only the client changes consent; program mode and bad input are refused', async () => {
    await link();
    expect(await code(setConsent(ctx(), trainer, { category: 'sets', level: 'full' }))).toBe(
      'not-found:no-relationship',
    );
    expect(await code(setConsent(ctx(), client, { category: 'sets', level: 'max' }))).toBe(
      'invalid-argument:invalid-level',
    );
    expect(await code(setConsent(ctx(), client, { category: 'photos', level: 'full' }))).toBe(
      'invalid-argument:invalid-category',
    );
    await setCoachingMode(ctx(), client, { clientId: 'c1', mode: 'program' });
    expect(await code(setConsent(ctx(), client, { category: 'sets', level: 'full' }))).toBe(
      'failed-precondition:program-mode',
    );
  });
  it('mode: the client any time; the trainer only down to program (which switches everything off)', async () => {
    await link({ totals: 'full', sets: 'full' });
    await evidence();
    expect(await code(setCoachingMode(ctx(), trainer, { clientId: 'c1', mode: 'hybrid' }))).toBe(
      'permission-denied:not-allowed',
    );
    expect(
      await code(
        setCoachingMode(ctx(), { uid: 't9', role: 'trainer' }, { clientId: 'c1', mode: 'program' }),
      ),
    ).toBe('permission-denied:not-allowed');
    await setCoachingMode(ctx(), trainer, { clientId: 'c1', mode: 'program' });
    expect(await kv.get('coaching/c1')).toMatchObject({ mode: 'program', consent: ALL_OFF });
    expect(kv.has('users/t1/decisions/d1/evidence/sets')).toBe(false);
    await setCoachingMode(ctx(), client, { clientId: 'c1', mode: 'app' });
    expect((await kv.get('coaching/c1'))?.mode).toBe('app');
    expect((await kv.get('coaching/c1'))?.consent).toEqual(ALL_OFF); // widening never restores access
  });
  it('end: inactive, key removed, epoch bumped, trainerId cleared, live/grant/evidence/pending requests gone', async () => {
    await link({ sets: 'full' });
    await evidence();
    await kv.merge(`conversations/${CID}`, { ck: { v: 1 }, keyEpoch: 1 });
    await kv.set('liveSessions/c1', { id: 'c1', trainerId: 't1', startedAt: 1, updatedAt: 1 });
    await kv.set('users/c1/grants/t1', { v: 1 });
    await kv.set(`conversations/${CID}/notes/n1`, { id: 'n1', enc: { v: 1 } });
    await kv.set(`conversations/${CID}/requests/r1`, {
      id: 'r1',
      from: 'client',
      status: 'pending',
      expiresAt: T0 + DAY,
    });
    expect(await code(coachEnd(ctx(), other, { clientId: 'c1' }))).toBe(
      'permission-denied:not-allowed',
    );
    await coachEnd(ctx(), trainer, { clientId: 'c1' });
    expect(await kv.get('coaching/c1')).toMatchObject({
      status: 'ended',
      endedBy: 'trainer',
      keyEpoch: 2,
    });
    const conv = await kv.get(`conversations/${CID}`);
    expect(conv?.active).toBe(false);
    expect(conv && 'ck' in conv).toBe(false);
    expect((await kv.get('users/c1'))?.trainerId).toBeNull();
    expect(kv.has('liveSessions/c1')).toBe(false);
    expect(kv.has('users/c1/grants/t1')).toBe(false);
    expect(kv.has('users/t1/decisions/d1/evidence/sets')).toBe(false);
    expect(kv.has('users/t1/decisions/d1/evidence/totals')).toBe(false);
    expect(kv.has('users/t1/decisions/d2/evidence/sets')).toBe(true);
    expect((await kv.get(`conversations/${CID}/requests/r1`))?.status).toBe('cancelled');
    expect(kv.has(`conversations/${CID}/notes/n1`)).toBe(false); // shared notes are cleared, not left as unreadable ciphertext
    expect(kv.has('users/c1/notices/tr-' + T0)).toBe(true);
    // the trainer is told, by name, that the client is gone (the notice text reads `detail`)
    const gone = await kv.get('users/t1/notices/cr-' + T0);
    expect(gone).toMatchObject({ kind: 'client-removed' });
    expect(typeof gone?.detail).toBe('string');
    expect(await coachEnd(ctx(), trainer, { clientId: 'c1' })).toMatchObject({ already: true });
  });
  it('re-link of the same pair keeps the cid but requires a new epoch', async () => {
    await link();
    await kv.merge(`conversations/${CID}`, { ck: { v: 1 }, keyEpoch: 1 });
    await coachEnd(ctx(), client, { clientId: 'c1' });
    const again = await link();
    expect(again.cid).toBe(CID);
    expect(again.keyEpoch).toBe(2);
    const conv = await kv.get(`conversations/${CID}`);
    expect(conv).toMatchObject({ active: true, keyEpoch: 1 });
    expect(conv && 'ck' in conv).toBe(false);
  });
  it('a failing transaction leaves nothing half-written', async () => {
    const inv = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app' });
    await kv.set('users/t1', { role: 'member' }); // trainer no longer a coach
    expect(await code(coachAccept(ctx(), client, { token: inv.inviteId }))).toBe(
      'failed-precondition:trainer-unavailable',
    );
    expect(await kv.get('coaching/c1')).toBeNull();
    expect((await kv.get(`invites/${inv.inviteId}`))?.claimedAt).toBeNull();
  });
});

describe('conversations: unread, flood limit, push, rotation (plan 10, C.3)', () => {
  const msg = (id: string, from: string, at: number, extra: Record<string, unknown> = {}) =>
    kv.set(`conversations/${CID}/messages/${id}`, {
      id,
      from,
      at,
      v: 1,
      keyEpoch: 1,
      enc: { v: 1, iv: 'i', ct: 'CT' },
      ...extra,
    });
  beforeEach(async () => {
    await link();
  });
  it('recomputes lastAt / lastFrom / unread from open fields and writes only on change', async () => {
    await msg('m1', 'c1', T0 + 1000);
    await msg('m2', 'c1', T0 + 2000);
    await msg('m3', 't1', T0 + 3000);
    expect((await recomputeConversation(ctx(), CID)).changed).toBe(true);
    expect(await kv.get(`conversations/${CID}`)).toMatchObject({
      unread: { c1: 1, t1: 2 },
      lastAt: T0 + 3000,
      lastFrom: 'trainer',
    });
    expect((await recomputeConversation(ctx(), CID)).changed).toBe(false);
    await kv.merge(`conversations/${CID}`, { readUpTo: { t1: T0 + 5000 } });
    await recomputeConversation(ctx(), CID);
    expect((await kv.get(`conversations/${CID}`))?.unread).toEqual({ c1: 1, t1: 0 });
    await kv.merge(`conversations/${CID}/messages/m3`, { del: { state: 'pending', at: T0 } });
    await recomputeConversation(ctx(), CID);
    expect(await kv.get(`conversations/${CID}`)).toMatchObject({
      unread: { c1: 0, t1: 0 },
      lastFrom: 'client',
    });
    expect((await recomputeConversation(ctx(), 'not-a-cid')).changed).toBe(false);
  });
  it('a new message pushes a content-free notice to the other side only', async () => {
    await msg('m1', 'c1', T0 + 1000);
    await afterMessageCreated(ctx(), CID, 'm1');
    expect(pushes).toEqual([['t1', 'message']]);
    expect(JSON.stringify(pushes)).not.toContain('CT');
  });
  it('the 31st message within a minute (SERVER time) is removed and not notified, backdated stamps gain nothing', async () => {
    for (let i = 0; i < 31; i++) await msg(`m${i}`, 'c1', T0 - 100_000 - i); // client-chosen `at` is irrelevant
    pushes = [];
    for (let i = 0; i < 30; i++) await afterMessageCreated(ctx(), CID, `m${i}`);
    expect(pushes.length).toBe(30);
    pushes = [];
    await afterMessageCreated(ctx(), CID, 'm30');
    expect(kv.has(`conversations/${CID}/messages/m30`)).toBe(false);
    expect(pushes).toEqual([]);
    await afterMessageCreated(ctx(), CID, 'm1'); // a retried trigger is not double counted
    expect(kv.has(`conversations/${CID}/messages/m1`)).toBe(true);
    expect(await kv.get(`rateLimits/${CID}_c1`)).toMatchObject({ updatedAt: T0 });
    t = T0 + 61_000; // the window passed
    await msg('m31', 'c1', t);
    await afterMessageCreated(ctx(), CID, 'm31');
    expect(kv.has(`conversations/${CID}/messages/m31`)).toBe(true);
  });
  it('a published key epoch clears the rotation flags; a trainer key change flags active conversations', async () => {
    await kv.merge(`conversations/${CID}`, { rotateDue: true, keyStale: true });
    expect(await onConversationKey(ctx(), CID, { keyEpoch: 1 }, { keyEpoch: 1 })).toBe(false);
    expect(await onConversationKey(ctx(), CID, { keyEpoch: 1 }, { keyEpoch: 2 })).toBe(true);
    expect(await kv.get(`conversations/${CID}`)).toMatchObject({
      rotateDue: false,
      keyStale: false,
      rotatedAt: T0,
    });
    // a re-wrap of the SAME epoch for a new trainer key (new wrap fingerprint) clears the stale flag too
    await kv.merge(`conversations/${CID}`, { keyStale: true });
    const wrapped = (fp: string) => ({ keyEpoch: 2, keyStale: true, ck: { epoch: 2, fp } });
    expect(await onConversationKey(ctx(), CID, wrapped('aaaa'), wrapped('aaaa'))).toBe(false);
    expect(await onConversationKey(ctx(), CID, wrapped('aaaa'), wrapped('bbbb'))).toBe(true);
    expect(await kv.get(`conversations/${CID}`)).toMatchObject({ keyStale: false });
    const pub = (x: string) => ({ pub: { kty: 'EC', crv: 'P-256', x, y: 'y' } });
    expect(await onCoachKeyChanged(ctx(), 't1', pub('a'), pub('a'))).toBe(0);
    expect(
      await onCoachKeyChanged(ctx(), 't1', { ...pub('a'), sig: 's' }, { ...pub('a'), sig: 's2' }),
    ).toBe(0);
    expect(await onCoachKeyChanged(ctx(), 't1', pub('a'), pub('b'))).toBe(1);
    expect((await kv.get(`conversations/${CID}`))?.keyStale).toBe(true);
    expect(await onCoachKeyChanged(ctx(), 't1', pub('a'), null)).toBe(0);
  });
  it('"Reset secure chat" is the client only', async () => {
    expect(await code(chatResetKey(ctx(), trainer, { cid: CID }))).toBe(
      'permission-denied:not-allowed',
    );
    expect(await code(chatResetKey(ctx(), client, { cid: 'bad' }))).toBe(
      'invalid-argument:bad-cid',
    );
    await chatResetKey(ctx(), client, { cid: CID });
    expect((await kv.get(`conversations/${CID}`))?.rotateDue).toBe(true);
  });
});

describe('reschedule requests (plan 11)', () => {
  const sealed = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    from: 'client',
    status: 'pending',
    createdAt: T0,
    expiresAt: T0 + 3 * DAY,
    slotKey: 'slot-1',
    keyEpoch: 1,
    enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
    ...over,
  });
  beforeEach(async () => {
    await link();
  });
  it('creates once per id, one pending per slot, validates open fields and notifies the other side', async () => {
    expect(await rescheduleCreate(ctx(), client, { clientId: 'c1', request: sealed() })).toEqual({
      id: 'r1',
      already: false,
    });
    expect(pushes).toEqual([['t1', 'request']]);
    expect(await rescheduleCreate(ctx(), client, { clientId: 'c1', request: sealed() })).toEqual({
      id: 'r1',
      already: true,
    });
    expect(
      await code(
        rescheduleCreate(ctx(), client, { clientId: 'c1', request: sealed({ id: 'r2' }) }),
      ),
    ).toBe('already-exists:duplicate-slot');
    expect(
      await code(
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: sealed({ id: 'r3', slotKey: 's3', expiresAt: T0 + 20 * DAY }),
        }),
      ),
    ).toBe('invalid-argument:ttl');
    expect(
      await code(
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: sealed({ id: 'r4', slotKey: 's4', createdAt: T0 - DAY }),
        }),
      ),
    ).toBe('invalid-argument:bad-time');
    expect(
      await code(
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: sealed({ id: 'r5', slotKey: 's5', extra: 'x' }),
        }),
      ),
    ).toBe('invalid-argument:unknown-field');
    expect(
      await code(
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: sealed({ id: 'r6', slotKey: 's6', enc: undefined }),
        }),
      ),
    ).toBe('invalid-argument:not-sealed');
    expect(
      await code(
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: sealed({ id: 'r7', slotKey: 's7', from: 'trainer' }),
        }),
      ),
    ).toBe('invalid-argument:bad-request');
    expect(
      await code(
        rescheduleCreate(ctx(), other, {
          clientId: 'c1',
          request: sealed({ id: 'r8', slotKey: 's8' }),
        }),
      ),
    ).toBe('permission-denied:not-allowed');
    expect(
      await code(
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: sealed({ id: 'r9', slotKey: 's9', status: 'accepted' }),
        }),
      ),
    ).toBe('invalid-argument:bad-status');
  });
  it('the other party answers once; the creator cancels; expired and decided requests are final', async () => {
    await rescheduleCreate(ctx(), client, { clientId: 'c1', request: sealed() });
    expect(
      await code(
        rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'accepted' }),
      ),
    ).toBe('failed-precondition:cannot-decide');
    t += 1000;
    expect(
      await rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r1', status: 'accepted' }),
    ).toEqual({ id: 'r1', status: 'accepted' });
    expect(await kv.get(`conversations/${CID}/requests/r1`)).toMatchObject({
      status: 'accepted',
      decidedAt: T0 + 1000,
    });
    expect(
      await code(
        rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r1', status: 'declined' }),
      ),
    ).toBe('failed-precondition:cannot-decide');
    await rescheduleCreate(ctx(), client, {
      clientId: 'c1',
      request: sealed({ id: 'r2', slotKey: 'slot-2' }),
    });
    await rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r2', status: 'cancelled' });
    await rescheduleCreate(ctx(), client, {
      clientId: 'c1',
      request: sealed({ id: 'r3', slotKey: 'slot-3', expiresAt: T0 + 2000 }),
    });
    t += 5000;
    expect(
      await code(
        rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r3', status: 'accepted' }),
      ),
    ).toBe('failed-precondition:expired');
    expect(
      await code(
        rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'nope', status: 'accepted' }),
      ),
    ).toBe('not-found:no-such-request');
  });
  it('after the relationship ended nothing can be created', async () => {
    await coachEnd(ctx(), client, { clientId: 'c1' });
    expect(await code(rescheduleCreate(ctx(), client, { clientId: 'c1', request: sealed() }))).toBe(
      'failed-precondition:not-active',
    );
  });
});

describe('the hourly sweep', () => {
  it('expires requests, tombstones stragglers, purges notes, trims audit, flags rotation', async () => {
    await link();
    const base = `conversations/${CID}`;
    await kv.set(`${base}/requests/old`, {
      id: 'old',
      status: 'pending',
      expiresAt: T0 - 1,
      slotKey: 'a',
    });
    await kv.set(`${base}/requests/live`, {
      id: 'live',
      status: 'pending',
      expiresAt: T0 + DAY,
      slotKey: 'b',
    });
    await kv.set(`${base}/messages/gone`, {
      id: 'gone',
      from: 'c1',
      at: T0 - 9,
      v: 1,
      keyEpoch: 1,
      enc: { ct: 'SECRET' },
      del: { state: 'pending', at: T0 - 120_000 },
    });
    await kv.set(`${base}/messages/undo`, {
      id: 'undo',
      from: 'c1',
      at: T0 - 9,
      v: 1,
      keyEpoch: 1,
      enc: { ct: 'X' },
      del: { state: 'pending', at: T0 - 1000 },
    });
    await kv.set(`${base}/notes/n1`, {
      id: 'n1',
      by: 't1',
      del: { state: 'pending', at: T0 - 120_000 },
      enc: {},
    });
    await kv.set('users/c1/audit/ancient', { at: T0 - 401 * DAY });
    await kv.set('users/c1/audit/recent', { at: T0 - 399 * DAY });
    await kv.set('teams/t1/activity/ancient', { ts: T0 - 91 * DAY });
    await kv.set('teams/t1/activity/recent', { ts: T0 - 89 * DAY });
    await kv.merge(base, { createdAt: T0 - 91 * DAY });
    const r = await sweep(ctx());
    expect(r).toEqual({
      requestsExpired: 1,
      messagesTombstoned: 1,
      notesPurged: 1,
      auditDeleted: 1,
      activityPurged: 1,
      rotationFlagged: 1,
      rateLimitsPurged: 0,
    });
    expect((await kv.get(`${base}/requests/old`))?.status).toBe('expired');
    expect((await kv.get(`${base}/requests/live`))?.status).toBe('pending');
    const tomb = await kv.get(`${base}/messages/gone`);
    expect(tomb).toEqual({
      id: 'gone',
      from: 'c1',
      at: T0 - 9,
      v: 1,
      keyEpoch: 1,
      deleted: true,
      deletedAt: T0,
    });
    expect(JSON.stringify(tomb)).not.toContain('SECRET');
    expect((await kv.get(`${base}/messages/undo`))?.deleted).toBeUndefined();
    expect(kv.has(`${base}/notes/n1`)).toBe(false);
    expect(kv.has('users/c1/audit/ancient')).toBe(false);
    expect(kv.has('users/c1/audit/recent')).toBe(true);
    expect(kv.has('teams/t1/activity/ancient')).toBe(false);
    expect(kv.has('teams/t1/activity/recent')).toBe(true);
    expect((await kv.get(base))?.rotateDue).toBe(true);
    expect(await sweep(ctx())).toEqual({
      requestsExpired: 0,
      messagesTombstoned: 0,
      notesPurged: 0,
      auditDeleted: 0,
      activityPurged: 0,
      rotationFlagged: 0,
      rateLimitsPurged: 0,
    });
  });
});

describe('coach key signature (key pinning, C.2 no. 5)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const signer = {
    kid: 'k1',
    sign: (p: string) => edSign(null, Buffer.from(p), privateKey).toString('base64'),
  };
  it('signs the fingerprint bound to the uid and updatedAt; the signature verifies and breaks on any change', async () => {
    const pub = { kty: 'EC', crv: 'P-256', x: 'XX', y: 'YY', ext: true, key_ops: [] };
    await kv.set('coachKeys/t1', { pub, updatedAt: 1234 });
    const r = await coachKeySign(ctx(), trainer, signer);
    expect(r.fp).toBe(keyFingerprint(pub));
    const stored = await kv.get('coachKeys/t1');
    expect(stored).toMatchObject({ sig: r.sig, kid: 'k1', signedAt: T0 });
    const ok = (uid: string, fp: string, at: number) =>
      edVerify(
        null,
        Buffer.from(coachKeySigPayload(uid, fp, at, 'k1')),
        publicKey,
        Buffer.from(r.sig, 'base64'),
      );
    expect(ok('t1', r.fp, 1234)).toBe(true);
    expect(ok('t2', r.fp, 1234)).toBe(false);
    expect(ok('t1', 'ffffffffffffffff', 1234)).toBe(false);
    expect(ok('t1', r.fp, 1235)).toBe(false);
  });
  it('a team manager gets their key signed too (key delegation); a plain member does not', async () => {
    const pub = { kty: 'EC', crv: 'P-256', x: 'XX', y: 'YY', ext: true, key_ops: [] };
    await kv.set('coachKeys/m9', { pub, updatedAt: 55 });
    const mgr = { uid: 'm9', role: 'manager' } as typeof trainer;
    expect((await coachKeySign(ctx(), mgr, signer)).fp).toBe(keyFingerprint(pub));
    expect(await kv.get('coachKeys/m9')).toMatchObject({ kid: 'k1', signedAt: T0 });
  });
  it('needs a coach and a well-formed P-256 public key', async () => {
    expect(await code(coachKeySign(ctx(), client, signer))).toBe('permission-denied:not-a-coach');
    expect(await code(coachKeySign(ctx(), trainer, signer))).toBe(
      'failed-precondition:no-public-key',
    );
    await kv.set('coachKeys/t1', { pub: { kty: 'RSA' }, updatedAt: 1 });
    expect(await code(coachKeySign(ctx(), trainer, signer))).toBe(
      'failed-precondition:no-public-key',
    );
  });
});

describe('no plaintext user content is ever written by the services', () => {
  it('a full flow leaves only ids, flags, counts and the sealed blobs the client provided', async () => {
    await link({ totals: 'full' });
    await rescheduleCreate(ctx(), client, {
      clientId: 'c1',
      request: {
        id: 'r1',
        from: 'client',
        status: 'pending',
        createdAt: T0,
        expiresAt: T0 + DAY,
        slotKey: 's',
        keyEpoch: 1,
        enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
      },
    });
    await coachRead(ctx(), trainer, { clientId: 'c1', categories: ['totals'] });
    expect(kv.dump()).not.toMatch(/hello|message text|reschedule to/i);
  });
});

describe('publishPlanVersion (R-BE-PRG-9)', () => {
  beforeEach(async () => {
    await link();
    await kv.set('plans/c1', {
      clientId: 'c1',
      trainerId: 't1',
      programId: 'p1',
      liveVersion: 1,
      rev: 3,
      updatedAt: 1,
      keyEpoch: 1,
      enc: {},
    });
    await kv.set('plans/c1/versions/1', {
      n: 1,
      programId: 'p1',
      state: 'live',
      createdAt: 1,
      keyEpoch: 1,
      enc: {},
    });
    await kv.set('plans/c1/versions/2', {
      n: 2,
      programId: 'p2',
      state: 'draft',
      createdAt: 2,
      keyEpoch: 1,
      enc: {},
    });
    await kv.set('plans/c1/versions/3', {
      n: 3,
      programId: 'p3',
      state: 'draft',
      createdAt: 3,
      keyEpoch: 1,
      enc: {},
    });
    // the runnable (template-level) programs the trainer's device writes before Send
    for (const id of ['p1', 'p2', 'p3'])
      await kv.set(`programs/${id}`, { id, authorId: 't1', status: 'draft', items: [] });
    await kv.set('assignments/c1', {
      memberId: 'c1',
      programId: 'p1',
      assignedBy: 't1',
      startedAt: 555,
    });
  });
  it('creates the member-readable program and the assignment (also when none existed), idempotently', async () => {
    await kv.del('assignments/c1');
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 2 });
    expect(await kv.get('programs/p2')).toMatchObject({ status: 'active', updatedAt: T0 });
    expect(await kv.get('programs/p3')).toMatchObject({ status: 'draft' });
    expect(await kv.get('assignments/c1')).toEqual({
      memberId: 'c1',
      programId: 'p2',
      assignedBy: 't1',
      startedAt: T0,
    });
    // a continuing plan keeps startedAt, so adherence does not restart with every version
    t += 5000;
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 3 });
    expect(await kv.get('assignments/c1')).toMatchObject({ programId: 'p3', startedAt: T0 });
    // a plan that replaces an assignment of someone else starts now
    await kv.set('assignments/c1', {
      memberId: 'c1',
      programId: 'own',
      assignedBy: 'c1',
      startedAt: 7,
    });
    await kv.set('plans/c1', { ...(await kv.get('plans/c1')), liveVersion: 3 });
    await kv.set('plans/c1/versions/4', {
      n: 4,
      programId: 'p4',
      state: 'draft',
      createdAt: 4,
      keyEpoch: 1,
      enc: {},
    });
    await kv.set('programs/p4', { id: 'p4', authorId: 't1', status: 'draft', items: [] });
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 4 });
    expect(await kv.get('assignments/c1')).toMatchObject({ programId: 'p4', startedAt: T0 + 5000 });
  });
  it("refuses a version whose runnable program is missing or not the trainer's own", async () => {
    await kv.del('programs/p2');
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 2 }))).toBe(
      'failed-precondition:no-program',
    );
    await kv.set('programs/p2', { id: 'p2', authorId: 'someone', status: 'draft', items: [] });
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 2 }))).toBe(
      'permission-denied:program-not-yours',
    );
    // nothing moved
    expect((await kv.get('plans/c1'))?.liveVersion).toBe(1);
    expect((await kv.get('assignments/c1'))?.programId).toBe('p1');
  });
  it('publishes the next draft: supersedes the old, moves the pointers, keeps one notice', async () => {
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 2 });
    expect((await kv.get('plans/c1/versions/1'))?.state).toBe('superseded');
    expect(await kv.get('plans/c1/versions/2')).toMatchObject({ state: 'live', publishedAt: T0 });
    expect(await kv.get('plans/c1')).toMatchObject({ liveVersion: 2, programId: 'p2', rev: 4 });
    expect((await kv.get('assignments/c1'))?.programId).toBe('p2');
    t += 1000;
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 3 });
    const notes = (await kv.list('users/c1/notices')).filter(
      (x) => x.data.kind === 'program-updated',
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].data).toMatchObject({ ref: { cid: CID, version: 3 }, readAt: null });
  });
  it('never skips, never republishes, only the active trainer', async () => {
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 3 }))).toBe(
      'failed-precondition:version-order',
    );
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 1 }))).toBe(
      'failed-precondition:version-order',
    );
    expect(await code(publishPlanVersion(ctx(), client, { clientId: 'c1', n: 2 }))).toBe(
      'permission-denied:not-your-client',
    );
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 0 }))).toBe(
      'invalid-argument:bad-version',
    );
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 2 });
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 2 }))).toBe(
      'failed-precondition:version-order',
    );
    await coachEnd(ctx(), client, { clientId: 'c1' });
    expect(await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 3 }))).toBe(
      'failed-precondition:not-active',
    );
  });
});

describe('device signing keys (C.2 no. 7)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const signer = {
    kid: 'srv1',
    sign: (p: string) => edSign(null, Buffer.from(p), privateKey).toString('base64'),
  };
  const point = () => Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString('base64');
  const kidOf = (i: number) => i.toString(16).padStart(16, '0');
  it('publishes a signed entry bound to the uid and kid; the signature breaks if anything changes', async () => {
    const raw = point();
    const r = await publishSignKey(ctx(), client, { kid: kidOf(1), publicRaw: raw }, signer);
    expect(await kv.get(`signKeys/c1/keys/${kidOf(1)}`)).toMatchObject({
      uid: 'c1',
      publicRaw: raw,
      srvKid: 'srv1',
    });
    const ok = (uid: string, kid: string, pub: string) =>
      edVerify(
        null,
        Buffer.from(signKeySigPayload('srv1', uid, kid, pub)),
        publicKey,
        Buffer.from(r.sig, 'base64'),
      );
    expect(ok('c1', kidOf(1), raw)).toBe(true);
    expect(ok('c2', kidOf(1), raw)).toBe(false);
    expect(ok('c1', kidOf(2), raw)).toBe(false);
    expect(ok('c1', kidOf(1), point())).toBe(false);
  });
  it('is idempotent, refuses a different key under the same kid, and keeps at most 10 per user', async () => {
    const raw = point();
    await publishSignKey(ctx(), client, { kid: kidOf(1), publicRaw: raw }, signer);
    await publishSignKey(ctx(), client, { kid: kidOf(1), publicRaw: raw }, signer);
    expect(
      await code(publishSignKey(ctx(), client, { kid: kidOf(1), publicRaw: point() }, signer)),
    ).toBe('already-exists:kid-taken');
    for (let i = 2; i <= 12; i++) {
      t += 1000;
      await publishSignKey(ctx(), client, { kid: kidOf(i), publicRaw: point() }, signer);
    }
    const keys = await kv.list('signKeys/c1/keys');
    expect(keys).toHaveLength(10);
    expect(keys.some((k) => k.id === kidOf(1))).toBe(false);
    expect(keys.some((k) => k.id === kidOf(12))).toBe(true);
  });
  it('validates kid and key shape', async () => {
    expect(
      await code(publishSignKey(ctx(), client, { kid: 'zz', publicRaw: point() }, signer)),
    ).toBe('invalid-argument:bad-kid');
    expect(
      await code(publishSignKey(ctx(), client, { kid: kidOf(1), publicRaw: 'AAAA' }, signer)),
    ).toBe('invalid-argument:bad-key');
    const compressed = Buffer.concat([Buffer.from([2]), randomBytes(64)]).toString('base64');
    expect(
      await code(publishSignKey(ctx(), client, { kid: kidOf(1), publicRaw: compressed }, signer)),
    ).toBe('invalid-argument:bad-key');
  });
});

describe('coachMyLink (the client sees only the trainer display name)', () => {
  it('is unlinked before accept, then returns name, since, cid and mode, and nothing else', async () => {
    expect(await coachMyLink(ctx(), client)).toEqual({ linked: false });
    await link({ totals: 'full' });
    const r = await coachMyLink(ctx(), client);
    expect(r).toEqual({
      linked: true,
      trainer: { id: 't1', name: 'Iryna' },
      since: T0,
      cid: CID,
      mode: 'app',
      consentVersion: 1,
      keyEpoch: 1,
    });
    await coachEnd(ctx(), client, { clientId: 'c1' });
    expect(await coachMyLink(ctx(), client)).toEqual({ linked: false });
  });
});

describe('parity: counters, late answers, program feedback', () => {
  const req = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    from: 'client',
    status: 'pending',
    createdAt: T0,
    expiresAt: T0 + DAY,
    slotKey: 'slot-1',
    keyEpoch: 1,
    enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
    ...over,
  });
  beforeEach(async () => {
    await link();
    pushes = [];
  });
  it('the other side may counter a pending request; the creator may not; a countered request is final', async () => {
    await rescheduleCreate(ctx(), client, { clientId: 'c1', request: req() });
    expect(
      await code(
        rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'countered' }),
      ),
    ).toBe('failed-precondition:cannot-decide');
    t += 1000;
    expect(
      await rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r1', status: 'countered' }),
    ).toEqual({ id: 'r1', status: 'countered' });
    // the counter is a new request that supersedes it, now allowed on the same slot
    await rescheduleCreate(ctx(), trainer, {
      clientId: 'c1',
      request: req({
        id: 'r2',
        from: 'trainer',
        supersedes: 'r1',
        createdAt: T0 + 1000,
        expiresAt: T0 + DAY,
      }),
    });
    expect(
      await code(
        rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r1', status: 'accepted' }),
      ),
    ).toBe('failed-precondition:cannot-decide');
    expect(pushes).toContainEqual(['c1', 'request']);
  });
  it('an answer after the deadline is refused as `expired`, before and after the sweep flipped the stored status', async () => {
    await rescheduleCreate(ctx(), client, { clientId: 'c1', request: req() });
    t += 2 * DAY;
    expect(
      await code(
        rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r1', status: 'declined' }),
      ),
    ).toBe('failed-precondition:expired');
    await sweep(ctx());
    expect(
      await code(
        rescheduleRespond(ctx(), trainer, { clientId: 'c1', id: 'r1', status: 'countered' }),
      ),
    ).toBe('failed-precondition:expired');
  });
  it('programAck: the member tells the trainer a live version was opened (idempotent, never a future version)', async () => {
    await kv.set('plans/c1', {
      clientId: 'c1',
      trainerId: 't1',
      programId: 'p1',
      liveVersion: 2,
      rev: 1,
      updatedAt: 1,
      keyEpoch: 1,
      enc: {},
    });
    expect(await code(programAck(ctx(), client, { version: 3 }))).toBe(
      'failed-precondition:version-order',
    );
    expect(await code(programAck(ctx(), client, { version: 0 }))).toBe(
      'invalid-argument:bad-version',
    );
    expect(await programAck(ctx(), client, { version: 2 })).toEqual({ ok: true, already: false });
    expect(await kv.get('users/t1/notices/pa-c1')).toMatchObject({
      kind: 'program-seen',
      actor: 'c1',
      ref: { version: 2 },
      readAt: null,
    });
    expect(await programAck(ctx(), client, { version: 1 })).toEqual({ ok: true, already: true });
    expect(await kv.get('users/t1/notices/pa-c1')).toMatchObject({ ref: { version: 2 } });
    expect(await code(programAck(ctx(), { uid: 'zz', role: 'member' }, { version: 1 }))).toBe(
      'not-found:no-relationship',
    );
  });
  it('publishPlanVersion pushes a content-free `program` notice to the member after it committed', async () => {
    await kv.set('plans/c1', {
      clientId: 'c1',
      trainerId: 't1',
      programId: 'p1',
      liveVersion: 0,
      rev: 1,
      updatedAt: 1,
      keyEpoch: 1,
      enc: {},
    });
    await kv.set('plans/c1/versions/1', {
      n: 1,
      programId: 'p1',
      state: 'draft',
      createdAt: 1,
      keyEpoch: 1,
      enc: {},
    });
    await kv.set('programs/p1', { id: 'p1', authorId: 't1', status: 'draft', items: [] });
    await publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 1 });
    expect(pushes).toEqual([['c1', 'program']]);
    pushes = [];
    await code(publishPlanVersion(ctx(), trainer, { clientId: 'c1', n: 1 })); // not a draft any more: refused
    expect(pushes).toEqual([]);
  });
});
