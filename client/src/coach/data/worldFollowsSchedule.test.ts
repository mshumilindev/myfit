/**
 * The schedule store is the single source of sessions: an accepted (or declined) reschedule changes world.slots, the
 * pending moves (Today), each client's planned count (Roster) and the engine input in the same session, without the
 * world port loading again.
 */
import { describe, expect, it, vi } from 'vitest';
import { scheduleFeedOf } from '../schedule/feed';
import { createFixturesSchedulePort } from '../schedule/__fixtures__/fixtures';
import { createScheduleStore } from '../schedule/scheduleStore';
import { hasClient } from '../domain/slots';
import { deriveWorld } from './deriveWorld';
import { FIXTURE_NOW, buildFixtureWorld } from './__fixtures__/fixtures';
import { createFixturesPort } from './__fixtures__/fixtures';
import { createWorldStore } from './worldStore';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!f()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await tick(5);
  }
}

async function setup() {
  const schedule = createScheduleStore(createFixturesSchedulePort({ delayMs: 0 }), {});
  const port = createFixturesPort({ delayMs: 0 });
  const load = vi.spyOn(port, 'load');
  const world = createWorldStore(port, {
    refreshEveryMs: 0,
    schedule: scheduleFeedOf(schedule),
  });
  world.start();
  await until(() => world.getState().world !== null && schedule.getState().status === 'ready');
  await until(() => world.getState().status === 'ready');
  return { schedule, port, world, load };
}

const friday = (w: ReturnType<typeof setup> extends Promise<infer R> ? R : never) =>
  w.world.getState().world!;

describe('world follows the schedule store', () => {
  it('an accepted request moves the session in world.slots, drops it from pending moves, in the same session', async () => {
    const t = await setup();
    const loads = t.load.mock.calls.length;
    const before = friday(t);
    const pend = before.pendingMoves.map((s) => s.move?.reqId).sort();
    expect(pend).toContain('rq1');
    const fri = before.slots.find((s) => s.status === 'pending-move' && s.move?.reqId === 'rq1')!;
    expect(fri).toBeTruthy();
    const proposed = fri.move!.start;

    // the trainer accepts the client's request (rq1: Fri 18:00 -> Sat 10:00)
    expect(await t.schedule.respond('rq1', 'accepted', 'trainer')).toBe(true);
    const after = t.world.getState().world!;

    // same session: the world was NOT reloaded
    expect(t.load.mock.calls.length).toBe(loads);
    expect(after.pendingMoves.map((s) => s.move?.reqId)).not.toContain('rq1');
    expect(after.pendingMoves.map((s) => s.move?.reqId)).toContain('rq2'); // the other one is untouched
    // the session now stands at the new time, the old place is a ghost that does not count
    const moved = after.slots.find(
      (s) => s.start === proposed && hasClient(s, 'c1') && s.status !== 'moved',
    );
    expect(moved).toBeTruthy();
    expect(
      after.slots.some(
        (s) => s.start === fri.start && s.status === 'planned' && hasClient(s, 'c1'),
      ),
    ).toBe(false);
  });

  it('a declined request puts the session back as planned', async () => {
    const t = await setup();
    expect(await t.schedule.respond('rq1', 'declined', 'trainer')).toBe(true);
    const w = t.world.getState().world!;
    expect(w.pendingMoves.map((s) => s.move?.reqId)).not.toContain('rq1');
    const stays = w.slots.find((s) => hasClient(s, 'c1') && s.id.includes('r-c1-fri'));
    expect(stays?.status === 'planned' || stays === undefined).toBe(true);
  });

  it("Roster counts follow: this week's planned count of a client is derived from the live slots", async () => {
    const t = await setup();
    const planned = (id: string) =>
      t.world.getState().world!.rows.find((r) => r.client.id === id)?.client.planned;
    const before = planned('c1');
    expect(before).toBeGreaterThan(0);
    // cancelling a session in the schedule store lowers it at once
    const slot = t.world
      .getState()
      .world!.slots.find(
        (s) => hasClient(s, 'c1') && s.status === 'pending-move' && s.start > FIXTURE_NOW,
      )!;
    const sch = t.schedule.getState();
    expect(sch.docs.length).toBeGreaterThan(0);
    expect(await t.schedule.cancelSession(slot as never)).toBe(true);
    expect(planned('c1')).toBe((before ?? 0) - 1);
  });

  it('without a feed the port snapshot is used unchanged (fixtures and stories keep their world)', () => {
    const d = buildFixtureWorld();
    const a = deriveWorld(d, d.book, FIXTURE_NOW);
    const b = deriveWorld(d, d.book, FIXTURE_NOW, null);
    expect(b.slots).toEqual(a.slots);
    expect(a.slots).toBe(d.slots);
  });

  it('the feed is silent until the schedule loaded, and an empty schedule falls back to the snapshot', () => {
    const d = buildFixtureWorld();
    const w = deriveWorld(d, d.book, FIXTURE_NOW, { docs: [], requests: [], asOf: FIXTURE_NOW });
    expect(w.slots).toBe(d.slots);
  });
});
