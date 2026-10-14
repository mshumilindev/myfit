import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNDO_MS } from '../chat/types';
import {
  createFixturesSchedulePort,
  FIXTURE_NOW,
  scheduleSeed,
  WEEK0,
} from './__fixtures__/fixtures';
import { generateSlots } from './model';
import { SchedulePortError } from './port';
import { createScheduleStore } from './scheduleStore';
import { tsOf } from './time';
import type { RescheduleRequest } from './types';

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => vi.useRealTimers());

const setup = (o: Parameters<typeof createFixturesSchedulePort>[0] = {}) => {
  const port = createFixturesSchedulePort(o);
  const posted: RescheduleRequest[] = [];
  const store = createScheduleStore(port, {
    onRequest: (r) => posted.push(r),
    isOnline: () => true,
  });
  store.start();
  return { port, store, posted };
};
const slotsOf = (s: ReturnType<typeof setup>['store']) =>
  generateSlots(s.getState().docs, s.getState().requests, {
    fromDay: WEEK0 - 14,
    toDay: WEEK0 + 60,
    now: FIXTURE_NOW,
  });
const row = (id: string, dow: number, start = '17:00') => ({
  id,
  dow,
  start,
  dur: 60,
  gymId: 'iron-yard',
});

describe('schedule store', () => {
  it('paints the snapshot at once and never blocks', () => {
    const { store } = setup();
    const st = store.getState();
    expect(st.status).toMatch(/stale|ready/);
    expect(st.docs.length).toBeGreaterThan(5);
  });
  it('is loading (not an error) when there is nothing yet, and offline is a state of the data', () => {
    const port = createFixturesSchedulePort({ empty: true });
    const s = createScheduleStore(port, { isOnline: () => false });
    s.start();
    expect(['offline', 'stale', 'ready']).toContain(s.getState().status);
  });

  it('saves a pattern, shows an 8 s undo, and Undo removes exactly what was added', async () => {
    const { store } = setup();
    const before = slotsOf(store).length;
    const ok = await store.save({
      clientIds: ['c9'],
      label: 'Maksym',
      pattern: { id: 'pn', fromDay: WEEK0 + 7, weeks: 4, rows: [row('rn1', 0), row('rn2', 3)] },
    });
    expect(ok).toBe(true);
    expect(slotsOf(store).length).toBe(before + 8);
    const p = store.getState().pendingSave!;
    expect(p.count).toBe(8);
    expect(p.until - FIXTURE_NOW).toBeGreaterThan(UNDO_MS - 1000);
    await store.undoSave();
    expect(slotsOf(store).length).toBe(before);
    expect(store.getState().pendingSave).toBeNull();
  });
  it('the undo window closes after 8 s and the sessions stay', async () => {
    const { store } = setup();
    await store.save({
      clientIds: ['c9'],
      label: 'x',
      oneOff: { id: 'oo', day: WEEK0 + 5, start: '11:00', dur: 45, gymId: 'iron-yard' },
    });
    expect(store.getState().pendingSave).not.toBeNull();
    vi.advanceTimersByTime(UNDO_MS + 10);
    expect(store.getState().pendingSave).toBeNull();
    expect(slotsOf(store).some((s) => s.id === `oo:${WEEK0 + 5}`)).toBe(true);
  });
  it('a shared session writes every attendee doc', async () => {
    const { store } = setup();
    const share = { groupId: 'g2', kind: 'split' as const };
    await store.save({
      clientIds: ['c4', 'c7'],
      label: 'split',
      oneOff: { id: 'sp', day: WEEK0 + 4, start: '08:00', dur: 60, gymId: 'iron-yard', share },
    });
    const s = slotsOf(store).find((x) => x.id === `sp:${WEEK0 + 4}`)!;
    expect(s.attendees.map((a) => a.clientId).sort()).toEqual(['c4', 'c7']);
  });
  it('a lost race re-reads, re-applies the same edit and retries once', async () => {
    const { store, port } = setup();
    port.bumpRev('c9'); // another device wrote first
    const ok = await store.save({
      clientIds: ['c9'],
      label: 'x',
      oneOff: { id: 'oo2', day: WEEK0 + 5, start: '11:00', dur: 45, gymId: 'iron-yard' },
    });
    expect(ok).toBe(true);
    expect(store.getState().failed).toBeNull();
  });
  it('two lost races in a row say "conflict" and write nothing', async () => {
    const { store, port } = setup();
    const real = port.saveDoc.bind(port);
    port.saveDoc = async () => {
      throw new SchedulePortError('conflict');
    };
    const ok = await store.save({
      clientIds: ['c9'],
      label: 'x',
      oneOff: { id: 'oo3', day: WEEK0 + 5, start: '11:00', dur: 45, gymId: 'iron-yard' },
    });
    expect(ok).toBe(false);
    expect(store.getState().failed).toBe('conflict');
    expect(slotsOf(store).some((s) => s.id.startsWith('oo3'))).toBe(false);
    port.saveDoc = real;
  });
  it('a failed write is rolled back and flagged, the screen stays usable', async () => {
    let fail = true;
    const { store } = setup({ failWrite: () => fail });
    const ok = await store.save({
      clientIds: ['c9'],
      label: 'x',
      oneOff: { id: 'oo4', day: WEEK0 + 5, start: '11:00', dur: 45, gymId: 'iron-yard' },
    });
    expect(ok).toBe(false);
    expect(store.getState().failed).toBe('save');
    expect(slotsOf(store).some((s) => s.id.startsWith('oo4'))).toBe(false);
    fail = false;
    store.clearFailed();
    expect(
      await store.save({
        clientIds: ['c9'],
        label: 'x',
        oneOff: { id: 'oo4', day: WEEK0 + 5, start: '11:00', dur: 45, gymId: 'iron-yard' },
      }),
    ).toBe(true);
  });
  it('refuses more than 8 weekly rows per client (R-BE-CAL-12)', async () => {
    const { store } = setup();
    const rows = Array.from({ length: 7 }, (_, i) => row(`x${i}`, i));
    expect(
      await store.save({
        clientIds: ['c1'],
        label: 'x',
        pattern: { id: 'big', fromDay: WEEK0 + 7, weeks: 2, rows },
      }),
    ).toBe(false);
    expect(store.getState().failed).toBe('limit');
  });
  it('cancels one session or removes one person; marks missed', async () => {
    const { store } = setup();
    const fri = slotsOf(store).find((s) => s.key === `r-c1-fri:${WEEK0 + 4}`)!;
    await store.cancelSession(fri);
    expect(slotsOf(store).some((s) => s.id === fri.id)).toBe(false);
    const grp = slotsOf(store).find((s) => s.key === `r-mob:${WEEK0 + 3}`)!;
    await store.cancelSession(grp, 'c5');
    expect(
      slotsOf(store)
        .find((s) => s.id === grp.id)!
        .attendees.map((a) => a.clientId)
        .sort(),
    ).toEqual(['c10', 'c2']);
    const sat = slotsOf(store).find((s) => s.key === `r-c14-sat:${WEEK0 + 5}`)!;
    await store.markMissed(sat, 'c14');
    expect(slotsOf(store).find((s) => s.id === sat.id)!.status).toBe('missed');
  });
});

describe('requests through the store', () => {
  const fri = (s: ReturnType<typeof setup>['store']) =>
    slotsOf(s).find((x) => x.key === `r-c3-fri:${WEEK0 + 4}`)!;
  it('creates a request, posts the card, shows the ghost; one open request per session', async () => {
    const { store, posted } = setup();
    const s = fri(store);
    const made = await store.request([
      { clientId: 'c3', from: 'trainer', slot: s, toStart: tsOf(WEEK0 + 7, 10 * 60), note: 'x' },
    ]);
    expect(made).toHaveLength(1);
    expect(posted).toHaveLength(1);
    expect(fri(store).status).toBe('pending-move');
    await expect(
      store.request([
        { clientId: 'c3', from: 'trainer', slot: s, toStart: tsOf(WEEK0 + 8, 10 * 60) },
      ]),
    ).rejects.toThrow(/open-request/);
  });
  it('the client accepts: the block moves; the creator cannot accept their own', async () => {
    const { store } = setup();
    const [r] = (await store.request([
      { clientId: 'c3', from: 'trainer', slot: fri(store), toStart: tsOf(WEEK0 + 7, 10 * 60) },
    ]))!;
    expect(await store.respond(r.id, 'accepted', 'trainer')).toBe(false);
    expect(store.getState().failed).toBe('answer');
    store.clearFailed();
    expect(await store.respond(r.id, 'accepted', 'client')).toBe(true);
    expect(slotsOf(store).find((x) => x.id === `r-c3-fri:${WEEK0 + 4}`)!.start).toBe(
      tsOf(WEEK0 + 7, 10 * 60),
    );
  });
  it('the trainer accepts the client request rq1: Today and the calendar agree (the block moves)', async () => {
    const { store } = setup();
    expect(await store.respond('rq1', 'accepted')).toBe(true);
    const s = slotsOf(store).find((x) => x.id === `r-c1-fri:${WEEK0 + 4}`)!;
    expect(s.start).toBe(tsOf(WEEK0 + 5, 10 * 60));
    expect(s.status).toBe('planned');
  });
  it('declining changes nothing; a double decline is idempotent', async () => {
    const { store } = setup();
    await store.respond('rq1', 'declined');
    await store.respond('rq1', 'declined');
    const s = slotsOf(store).find((x) => x.id === `r-c1-fri:${WEEK0 + 4}`)!;
    expect(s.start).toBe(tsOf(WEEK0 + 4, 18 * 60));
    expect(s.status).toBe('planned');
  });
  it('a counter-proposal replaces the old request in one step (old = countered, new supersedes it)', async () => {
    const { store, posted } = setup();
    const n = await store.counter('rq1', {
      clientId: 'c1',
      slot: { key: `r-c1-fri:${WEEK0 + 4}`, start: tsOf(WEEK0 + 4, 18 * 60) },
      toStart: tsOf(WEEK0 + 6, 18 * 60),
      note: 'Sunday?',
    });
    expect(n).toMatchObject({ from: 'trainer', supersedes: 'rq1', status: 'pending' });
    const st = store.getState().requests;
    expect(st.find((r) => r.id === 'rq1')!.status).toBe('countered');
    expect(st.filter((r) => r.status === 'pending' && r.clientId === 'c1')).toHaveLength(1);
    expect(posted.at(-1)!.id).toBe(n!.id);
  });
  it('a failed create is rolled back', async () => {
    let fail = false;
    const { store } = setup({ failWrite: () => fail });
    fail = true;
    const before = store.getState().requests.length;
    expect(
      await store.request([
        { clientId: 'c3', from: 'trainer', slot: fri(store), toStart: tsOf(WEEK0 + 7, 10 * 60) },
      ]),
    ).toBeNull();
    expect(store.getState().requests.length).toBe(before);
    expect(store.getState().failed).toBe('request');
  });
  it('a whole-session move is one request per person; Cancel the move withdraws only the open ones; an accepted answer is kept', async () => {
    const { store } = setup();
    const grp = slotsOf(store).find((s) => s.key === `r-mob:${WEEK0 + 3}`)!;
    const made = await store.request(
      grp.attendees.map((a) => ({
        clientId: a.clientId,
        from: 'trainer' as const,
        slot: grp,
        toStart: tsOf(WEEK0 + 4, 12 * 60),
        groupKey: 'gk1',
      })),
    );
    expect(made).toHaveLength(3);
    expect(slotsOf(store).find((s) => s.id === grp.id)!.status).toBe('pending-move');
    await store.respond(made![0].id, 'accepted', 'client');
    await store.cancelGroup('gk1');
    const mine = store.getState().requests.filter((r) => r.groupKey === 'gk1');
    expect(mine.find((r) => r.id === made![0].id)!.status).toBe('accepted');
    expect(mine.filter((r) => r.id !== made![0].id).every((r) => r.status === 'cancelled')).toBe(
      true,
    );
    // the move did not happen: not everyone said yes
    expect(slotsOf(store).find((s) => s.id === grp.id)!.start).toBe(grp.start);
  });
  it('the seed holds rq1 and rq2 as the world does', () => {
    const seed = scheduleSeed();
    expect(
      seed.requests
        .filter((r) => r.status === 'pending')
        .map((r) => r.id)
        .sort(),
    ).toEqual(['rq1', 'rq2']);
  });
});

describe('markDone (iter19)', () => {
  it('marks one attendee of a past session done, through the same write path as markMissed', async () => {
    const { port, store } = setup();
    const doc = store.getState().docs.find((d) => d.patterns.length)!;
    const slot = generateSlots([doc], [], {
      fromDay: doc.patterns[0].fromDay,
      toDay: doc.patterns[0].fromDay + 14,
      now: port.now(),
    })[0];
    expect(await store.markDone(slot, doc.clientId)).toBe(true);
    const after = store.getState().docs.find((d) => d.clientId === doc.clientId)!;
    expect(after.exceptions).toContainEqual({ slotKey: slot.key, status: 'done' });
    expect(await store.markMissed(slot, doc.clientId)).toBe(true);
    const again = store.getState().docs.find((d) => d.clientId === doc.clientId)!;
    expect(again.exceptions.filter((e) => e.slotKey === slot.key)).toEqual([
      { slotKey: slot.key, status: 'missed' },
    ]);
  });
});
