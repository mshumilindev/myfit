/**
 * F4 reschedule requests and counter-proposals, both directions, on the shared store with the rules enforced:
 * request, card in the chat, push, accept / decline / counter, expiry and the message for a late answer.
 */
import { describe, expect, it } from 'vitest';
import { configureCoachData } from '../config';
import { configureClientCoach } from '../../client/data/config';
import { scheduleStoreFor } from '../../schedule/useSchedule';
import { generateSlots, statusAt } from '../../schedule/model';
import { dayOfTs, weekStartDay } from '../../schedule/time';
import { opaqueSlotKey } from '../../schedule/ids';
import type { RescheduleRequest } from '../../schedule/types';
import { C, NOW, T } from './parity/harness';
import { latest, linkUp, settle, type World } from './parity/flow';

const HOUR = 3600_000;
type Store = ReturnType<typeof scheduleStoreFor>;
const slotsOf = (st: Store, now: number) =>
  generateSlots(st.getState().docs, st.getState().requests, {
    fromDay: weekStartDay(dayOfTs(now)) - 7,
    toDay: weekStartDay(dayOfTs(now)) + 60,
    now,
  });

async function setup(): Promise<{
  w: World;
  ts: Store;
  cs: Store;
  planned: ReturnType<typeof slotsOf>;
}> {
  const w = await linkUp();
  configureCoachData({ chat: w.tr.chat, uid: T });
  configureClientCoach({ chat: w.cl.chatClient, port: w.cl.port });
  const ts = scheduleStoreFor(w.tr.schedule);
  const cs = scheduleStoreFor(w.cl.schedule);
  ts.start();
  cs.start();
  await settle(50);
  const today = dayOfTs(NOW);
  const ok = await ts.save({
    clientIds: [C],
    label: 'weekly',
    pattern: {
      id: 'p1',
      fromDay: today,
      weeks: 8,
      rows: [{ id: 'r1', dow: 1, start: '18:00', dur: 60, gymId: 'iron-yard' }],
    },
  });
  expect(ok).toBe(true);
  await settle(80);
  const planned = slotsOf(ts, NOW).filter((x) => x.status === 'planned' && !x.oneOff);
  expect(planned.length).toBeGreaterThan(5);
  return { w, ts, cs, planned };
}

const cards = async (w: World, side: 'trainer' | 'client') => {
  const chat = side === 'trainer' ? w.tr.chat : w.cl.chat;
  const msgs =
    (await latest<{ body: { kind: string; reqId?: string } }[]>((on, er) =>
      chat.subscribeMessages(w.cid, (m) => on(m as never), er),
    )) ?? [];
  return msgs.filter((m) => m.body.kind === 'request').map((m) => m.body.reqId);
};
const find = (st: Store, f: (r: RescheduleRequest) => boolean) => st.getState().requests.find(f);

describe('F4 counters, both directions', () => {
  it('trainer proposes -> client suggests another time (counter) -> trainer accepts it', async () => {
    const { w, ts, cs, planned } = await setup();
    const target = planned[1];
    const [first] = (await ts.request([
      {
        clientId: C,
        from: 'trainer',
        slot: { key: target.key, start: target.start },
        toStart: target.start + 24 * HOUR,
        note: 'Gym closed',
        scope: 'all',
      },
    ]))!;
    await settle(80);
    expect(find(cs, (r) => r.id === first.id)).toBeTruthy();
    expect(await cards(w, 'client')).toContain(first.id);
    expect(w.s.pushes.some((p) => p.uid === C && p.kind === 'request')).toBe(true);

    // what the client's "Suggest another time" does on the trainer's card
    const counter = await cs.counter(first.id, {
      clientId: C,
      slot: { key: target.key, start: target.start },
      toStart: target.start + 48 * HOUR,
      scope: 'all',
    });
    expect(counter).not.toBeNull();
    expect(counter!.from).toBe('client');
    expect(counter!.supersedes).toBe(first.id);
    await settle(100);
    // the trainer sees the old request answered as a counter and the new one waiting for them
    expect(find(ts, (r) => r.id === first.id)?.status).toBe('countered');
    const seen = find(ts, (r) => r.supersedes === first.id);
    expect(seen).toMatchObject({
      from: 'client',
      status: 'pending',
      toStart: target.start + 48 * HOUR,
    });
    expect(statusAt(seen!, NOW)).toBe('pending');
    // the card of the counter is in the thread of both
    expect(await cards(w, 'trainer')).toEqual(expect.arrayContaining([first.id, counter!.id]));
    expect(await cards(w, 'client')).toEqual(expect.arrayContaining([first.id, counter!.id]));
    expect(w.s.pushes.some((p) => p.uid === T && p.kind === 'request')).toBe(true);
    // the trainer accepts the counter: the session moves for the client
    expect(await ts.respond(seen!.id, 'accepted', 'trainer')).toBe(true);
    await settle(100);
    expect(find(cs, (r) => r.id === counter!.id)?.status).toBe('accepted');
    const moved = slotsOf(cs, NOW).find((x) => x.key === target.key && x.status !== 'moved');
    expect(moved?.start).toBe(target.start + 48 * HOUR);
    expect(w.cl.fs.denied).toEqual([]);
    expect(w.tr.fs.denied).toEqual([]);
  });

  it('client asks -> trainer counters -> client declines the counter; the trainer sees it', async () => {
    const { w, ts, cs, planned } = await setup();
    const t3 = planned[3];
    const [mine] = (await cs.request([
      {
        clientId: C,
        from: 'client',
        slot: { key: t3.key, start: t3.start },
        toStart: t3.start + HOUR,
        scope: 'all',
      },
    ]))!;
    await settle(100);
    const seen = find(ts, (r) => r.from === 'client' && r.slotKey === opaqueSlotKey(t3.key));
    expect(seen).toBeTruthy();
    expect(await cards(w, 'trainer')).toContain(mine.id);
    expect(w.s.pushes.filter((p) => p.uid === T && p.kind === 'request').length).toBeGreaterThan(0);

    const tc = await ts.counter(seen!.id, {
      clientId: C,
      slot: { key: t3.key, start: t3.start },
      toStart: t3.start + 2 * HOUR,
      scope: 'all',
    });
    expect(tc).not.toBeNull();
    expect(ts.getState().failed).toBeNull();
    await settle(100);
    expect(find(cs, (r) => r.id === mine.id)?.status).toBe('countered');
    const back = find(cs, (r) => r.supersedes === mine.id);
    expect(back).toMatchObject({
      from: 'trainer',
      status: 'pending',
      toStart: t3.start + 2 * HOUR,
    });
    expect(await cards(w, 'client')).toEqual(expect.arrayContaining([mine.id, tc!.id]));
    expect(w.s.pushes.some((p) => p.uid === C && p.kind === 'request')).toBe(true);

    expect(await cs.respond(back!.id, 'declined', 'client')).toBe(true);
    await settle(100);
    expect(find(ts, (r) => r.id === tc!.id)?.status).toBe('declined');
    // nothing moved
    const still = slotsOf(cs, NOW).find((x) => x.key === t3.key && x.status === 'planned');
    expect(still?.start).toBe(t3.start);
    expect(w.cl.fs.denied).toEqual([]);
    expect(w.tr.fs.denied).toEqual([]);
  });

  it('client asks -> trainer counters -> client ACCEPTS the counter and the session moves', async () => {
    const { ts, cs, planned } = await setup();
    const t = planned[2];
    const [mine] = (await cs.request([
      {
        clientId: C,
        from: 'client',
        slot: { key: t.key, start: t.start },
        toStart: t.start + HOUR,
        scope: 'all',
      },
    ]))!;
    await settle(100);
    const seen = find(ts, (r) => r.id === mine.id)!;
    const tc = (await ts.counter(seen.id, {
      clientId: C,
      slot: { key: t.key, start: t.start },
      toStart: t.start + 3 * HOUR,
      scope: 'all',
    }))!;
    await settle(100);
    expect(await cs.respond(tc.id, 'accepted', 'client')).toBe(true);
    await settle(100);
    expect(find(ts, (r) => r.id === tc.id)?.status).toBe('accepted');
    expect(slotsOf(ts, NOW).find((x) => x.key === t.key && x.status !== 'moved')?.start).toBe(
      t.start + 3 * HOUR,
    );
  });

  it('the creator cannot counter their own request, and a counter needs a pending request (server rules of the state machine)', async () => {
    const { w, ts, cs, planned } = await setup();
    const t = planned[1];
    const [r] = (await ts.request([
      {
        clientId: C,
        from: 'trainer',
        slot: { key: t.key, start: t.start },
        toStart: t.start + HOUR,
        scope: 'all',
      },
    ]))!;
    await settle(80);
    await expect(
      w.tr.fs.call('rescheduleRespond', { clientId: C, id: r.id, status: 'countered' }),
    ).rejects.toMatchObject({ reason: 'cannot-decide' });
    await cs.respond(r.id, 'declined', 'client');
    await settle(60);
    await expect(
      w.cl.fs.call('rescheduleRespond', { clientId: C, id: r.id, status: 'countered' }),
    ).rejects.toMatchObject({ reason: 'cannot-decide' });
  });

  it('a request runs out: the answer is refused with a clear message in both apps', async () => {
    const { w, ts, cs, planned } = await setup();
    const t = planned[4];
    const [fromT] = (await ts.request([
      {
        clientId: C,
        from: 'trainer',
        slot: { key: t.key, start: t.start },
        toStart: t.start + HOUR,
        scope: 'all',
      },
    ]))!;
    const t5 = planned[5];
    const [fromC] = (await cs.request([
      {
        clientId: C,
        from: 'client',
        slot: { key: t5.key, start: t5.start },
        toStart: t5.start + HOUR,
        scope: 'all',
      },
    ]))!;
    await settle(100);
    // the sweep flips the stored status, then both answer late
    w.s.fs.setNow(NOW + 20 * 24 * HOUR);
    await (await import('../../../../../functions/src/coach/service')).sweep(w.s.ctx);
    await settle(60);
    expect(find(cs, (r) => r.id === fromT.id)?.status).toBe('expired');
    // server: `expired`, not `cannot-decide`
    await expect(
      w.cl.fs.call('rescheduleRespond', { clientId: C, id: fromT.id, status: 'declined' }),
    ).rejects.toMatchObject({ reason: 'expired' });
    await expect(
      w.tr.fs.call('rescheduleRespond', { clientId: C, id: fromC.id, status: 'declined' }),
    ).rejects.toMatchObject({ reason: 'expired' });
    // stores: the failure is `expired` (the cards show the localized "ask for a new time" text)
    await cs.respond(fromT.id, 'declined', 'client');
    expect(cs.getState().failed).toBe('expired');
    cs.clearFailed();
    await ts.respond(fromC.id, 'accepted', 'trainer');
    expect(ts.getState().failed).toBe('expired');
    ts.clearFailed();
    // a counter on an expired request is refused the same way
    const none = await cs.counter(fromT.id, {
      clientId: C,
      slot: { key: t.key, start: t.start },
      toStart: t.start + 5 * HOUR + 14 * 24 * HOUR,
      scope: 'all',
    });
    expect(none).toBeNull();
    expect(cs.getState().failed).toBe('expired');
  });
});
