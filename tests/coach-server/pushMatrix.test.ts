import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  rescheduleCreate,
  rescheduleRespond,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import {
  clientRemovalCreate,
  clientRemovalRespond,
  inviteClientForTrainer,
  teamDecline,
  teamInvite,
  teamLeave,
  teamLogActivity,
  teamRemoveMember,
  teamSetActivityScope,
} from '../../functions/src/coach/team';
import {
  REMIND_BEFORE,
  UNMARKED_AFTER,
  runReminders,
  runUnanswered,
} from '../../functions/src/coach/reminders';
import { DAY, conversationId } from '../../functions/src/coach/logic';
import { categoryOf, pushTag, type CoachNoticeKind } from '../../functions/src/coach/pushPolicy';
import { PUSH_LOCALES, PUSH_TEXTS, defaultTextKey } from '../../functions/src/coach/pushText';

// SPO-237: who gets which push, role by role. Every push is (recipient, kind, topic) and nothing else: the tag and the
// text come from the kind, so the matrix below pins the tag each person sees and proves the text carries no content.
const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const PEPPER = new Uint8Array(32);
const owner: Actor = { uid: 't1', role: 'trainer' };
const client: Actor = { uid: 'c1', role: 'member' };
const mgr: Actor = { uid: 'm1', role: 'manager' };

let kv: MemoryKv;
let clock = T0;
let n = 0;
type Push = [uid: string, kind: CoachNoticeKind, topic: string | undefined];
let pushes: Push[] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => clock,
  pepper: PEPPER,
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
  notify: async (uid, kind, topic) => void pushes.push([uid, kind, topic]),
});
const ROLE: Record<string, string> = { t1: 'trainer', m1: 'manager', c1: 'client' };
/** what each role is shown: `role: coach-tag[/topic]`, sorted */
async function got(action: () => Promise<unknown>): Promise<string[]> {
  pushes = [];
  await action();
  return pushes
    .map(([uid, kind, topic]) => `${ROLE[uid]}: ${pushTag(kind)}${topic ? `/${topic}` : ''}`)
    .sort();
}
const req = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  from: 'trainer',
  status: 'pending',
  createdAt: T0,
  expiresAt: T0 + 3 * DAY,
  slotKey: 'slot-1',
  keyEpoch: 1,
  enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
  ...over,
});

beforeEach(async () => {
  kv = createMemoryKv();
  clock = T0;
  n = 0;
  pushes = [];
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
});

describe('push matrix: the TRAINER', () => {
  it('hears a client request, a client answer, a manager proposal and a manager removal request', async () => {
    expect(
      await got(() =>
        rescheduleCreate(ctx(), client, {
          clientId: 'c1',
          request: req({ id: 'rc', from: 'client', slotKey: 'sc' }),
        }),
      ),
    ).toEqual(['trainer: coach-request']);
    expect(
      await got(() => rescheduleCreate(ctx(), owner, { clientId: 'c1', request: req() })),
    ).toEqual(['client: coach-request']);
    // the client answers the trainer's own proposal: the trainer is told (SPO-237: replies of the client)
    expect(
      await got(() =>
        rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'accepted' }),
      ),
    ).toEqual(['trainer: coach-request']);
    expect(
      await got(() =>
        rescheduleCreate(ctx(), mgr, {
          clientId: 'c1',
          request: req({ id: 'r2', slotKey: 's2', via: 'manager' }),
        }),
      ),
    ).toEqual(['client: coach-request', 'trainer: coach-team']);
    expect(await got(() => clientRemovalCreate(ctx(), mgr, { clientId: 'c1' }))).toEqual([
      'trainer: coach-team',
    ]);
  });

  it('team changes: a link declined (once), somebody leaves', async () => {
    const inv2 = await teamInvite(ctx(), owner, { email: 'third@example.com' });
    expect(
      await got(() =>
        teamDecline(
          ctx(),
          { uid: 'x9', role: 'member', email: 'third@example.com' },
          { inviteId: inv2.inviteId },
        ),
      ),
    ).toEqual(['trainer: coach-team']);
    // a repeated decline changes nothing and tells nobody again
    expect(
      await got(() =>
        teamDecline(
          ctx(),
          { uid: 'x9', role: 'member', email: 'third@example.com' },
          { inviteId: inv2.inviteId },
        ),
      ),
    ).toEqual([]);
    expect(await got(() => teamLeave(ctx(), mgr))).toEqual([
      'client: coach-team',
      'trainer: coach-team',
    ]);
  });

  it('"session not marked" and "request unanswered": a team push and a reminder push', async () => {
    const end = T0 - 3 * H;
    await kv.set('schedules/c1', {
      clientId: 'c1',
      trainerId: 't1',
      rev: 1,
      enc: {},
      timing: { starts: [], unmarked: [end], dueAt: end + UNMARKED_AFTER },
    });
    clock = end + UNMARKED_AFTER;
    expect(await got(() => runReminders(ctx()))).toEqual([
      'manager: coach-team',
      'trainer: coach-team',
    ]);
    clock = T0 + 2 * DAY;
    const cid = conversationId(PEPPER, 'c1', 't1');
    await kv.set(`conversations/${cid}`, { clientId: 'c1', trainerId: 't1', active: true });
    await kv.set(`conversations/${cid}/requests/q1`, {
      id: 'q1',
      from: 'client',
      status: 'pending',
      createdAt: T0,
      expiresAt: T0 + 5 * DAY,
    });
    expect(await got(() => runUnanswered(ctx()))).toEqual(['trainer: coach-reminder']);
  });
});

describe('push matrix: the MANAGER', () => {
  it('hears the answers (accepted / declined / approved), an access change, being removed and a trainer who joined', async () => {
    await rescheduleCreate(ctx(), mgr, {
      clientId: 'c1',
      request: req({ id: 'rm1', slotKey: 'sm', via: 'manager' }),
    });
    expect(
      await got(() =>
        rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'rm1', status: 'declined' }),
      ),
    ).toEqual(['manager: coach-team']);
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    expect(
      await got(() => clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: false })),
    ).toEqual(['manager: coach-team']);
    expect(
      await got(() => teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' })),
    ).toEqual(['manager: coach-team/access']);
    // a trainer joins by the manager's link: the inviting manager is told
    await kv.set('users/t2', { role: 'trainer', status: 'active', firstName: 'Andriy' });
    const inv = await teamInvite(ctx(), mgr, { email: 'andriy@example.com' });
    expect(
      await got(() =>
        acceptWithMail(
          ctx(),
          { uid: 't2', role: 'trainer', email: 'andriy@example.com' },
          { inviteId: inv.inviteId },
        ),
      ),
    ).toEqual(['manager: coach-team']);
    expect(await got(() => teamRemoveMember(ctx(), owner, { uid: 'm1' }))).toEqual([
      'client: coach-team',
      'manager: coach-team',
    ]);
  });

  it('a manager who invited a trainer hears the refusal', async () => {
    const inv = await teamInvite(ctx(), mgr, { email: 'andriy@example.com' });
    expect(
      await got(() =>
        teamDecline(
          ctx(),
          { uid: 't2', role: 'trainer', email: 'andriy@example.com' },
          { inviteId: inv.inviteId },
        ),
      ),
    ).toEqual(['manager: coach-team']);
  });
});

describe('push matrix: the CLIENT', () => {
  it('hears a proposal from the team, a cancellation, a mark and a reminder before the session', async () => {
    expect(
      await got(() =>
        rescheduleCreate(ctx(), mgr, {
          clientId: 'c1',
          request: req({ id: 'rm1', slotKey: 'sm', via: 'manager' }),
        }),
      ),
    ).toEqual(['client: coach-request', 'trainer: coach-team']);
    expect(
      await got(() => teamLogActivity(ctx(), mgr, { kind: 'session-cancelled', clientId: 'c1' })),
    ).toEqual(['client: coach-team', 'trainer: coach-team']);
    expect(
      await got(() => teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c1' })),
    ).toEqual(['client: coach-team', 'trainer: coach-team']);
    // an edit that is neither done, missed nor cancelled is not announced
    expect(
      await got(() => teamLogActivity(ctx(), mgr, { kind: 'session-edited', clientId: 'c1' })),
    ).toEqual([]);
    const start = T0 + REMIND_BEFORE + 2 * H;
    await kv.set('schedules/c1', {
      clientId: 'c1',
      trainerId: 't1',
      rev: 1,
      enc: {},
      timing: { starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE },
    });
    clock = start - REMIND_BEFORE + 60_000;
    expect(await got(() => runReminders(ctx()))).toEqual(['client: coach-reminder']);
  });

  it('a manager who joins is announced to the client by a team push and a silent sync push', async () => {
    await kv.set('users/m2', { role: 'member', status: 'active', firstName: 'Second' });
    const inv = await teamInvite(ctx(), owner, { email: 'second@example.com' });
    expect(
      await got(() =>
        acceptWithMail(ctx(), { uid: 'm2', role: 'member' }, { inviteId: inv.inviteId }),
      ),
    ).toEqual(['client: coach-sync', 'client: coach-team', 'trainer: coach-team']);
  });

  it('a manager inviting a client tells the trainer, never the (not yet existing) client', async () => {
    expect(
      await got(() =>
        inviteClientForTrainer(ctx(), mgr, { trainerId: 't1', name: 'New', mode: 'app' }),
      ),
    ).toEqual(['trainer: coach-team']);
  });
});

describe('push matrix: content-free', () => {
  it('every kind a push can carry has one category, a coach tag, and a text without names, digits or links in five locales', () => {
    const kinds: CoachNoticeKind[] = [
      'message',
      'invite',
      'request',
      'program',
      'team',
      'reminder',
      'sync',
    ];
    for (const k of kinds) {
      expect(pushTag(k)).toMatch(/^coach-/);
      if (k !== 'sync') expect(categoryOf(k)).not.toBeNull();
    }
    const names = ['Oleh', 'Irina', 'Olena', 'Andriy'];
    for (const locale of PUSH_LOCALES)
      for (const k of kinds.filter((x) => x !== 'sync')) {
        const text = PUSH_TEXTS[locale][defaultTextKey(k)];
        expect(text, `${locale}/${k}`).toBeTruthy();
        expect(text).not.toMatch(/\d|https?:|@/);
        for (const nm of names) expect(text).not.toContain(nm);
      }
    for (const locale of PUSH_LOCALES)
      expect(PUSH_TEXTS[locale].access).not.toMatch(/\d|https?:|@/);
  });

  it('a push is only (recipient, kind, topic): nothing else of the event can ride along', async () => {
    const seen: unknown[][] = [];
    const spy: Ctx = { ...ctx(), notify: async (...a) => void seen.push(a) };
    await rescheduleCreate(spy, mgr, {
      clientId: 'c1',
      request: req({ id: 'rm9', slotKey: 'sm9', via: 'manager' }),
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const a of seen) {
      expect(a.length).toBeLessThanOrEqual(3);
      expect(JSON.stringify(a)).not.toMatch(/Oleh|Irina|Olena|slot|ct/);
    }
  });
});
