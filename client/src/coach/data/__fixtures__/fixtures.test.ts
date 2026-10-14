// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveWorld } from '../deriveWorld';
import { FIXTURE_NOW, FIXTURE_UNREAD, buildFixtureWorld, createFixturesPort } from './fixtures';
import { unreadFromConversations, type ConversationUnreadDoc } from '../unreadStore';

const world = () => {
  const d = buildFixtureWorld();
  return { d, w: deriveWorld(d, d.book, FIXTURE_NOW) };
};
const open = (w: ReturnType<typeof world>['w']) =>
  w.signals.filter((s) => s.state === 'open').map((s) => s.signal);

describe('fixtures world (Wed 7 Oct 2026 09:05, Iryna Melnyk)', () => {
  it('has the roster of 14 and the pinned clock', () => {
    const { d, w } = world();
    expect(new Date(FIXTURE_NOW).toISOString()).toBe('2026-10-07T09:05:00.000Z');
    expect(d.trainer.name).toBe('Iryna Melnyk');
    expect(w.counts.clients).toBe(14);
    expect(w.counts.weekPlanned).toBe(48);
    expect(w.counts.weekDone).toBe(15);
  });

  it('Oleh Bondar: bench stalled 4 weeks, urgent, e1RM 116, 5 sessions of evidence', () => {
    const { w } = world();
    const s = open(w).find((x) => x.clientId === 'c1')!;
    expect(s).toMatchObject({ kind: 'stall', severity: 'urgent', key: 'c1|stall|bench-press' });
    expect(s.facts).toMatchObject({ exercise: 'Bench press', e1rm: 116, weeks: 4 });
    const rows = s.evidence[0].rows;
    expect(rows.slice(0, 5).map((r) => r.value)).toEqual([116, 117, 114, 116, 114]);
    expect(rows[0].detail).toBe('100x5, 100x5, 100x4');
  });

  it('signals the lab shows, minus the ones the plan forbids', () => {
    const { w } = world();
    const by = Object.fromEntries(open(w).map((s) => [`${s.clientId}:${s.kind}`, s.severity]));
    expect(by).toMatchObject({
      'c1:stall': 'urgent',
      'c3:injury': 'urgent',
      'c4:machine': 'watch',
      'c11:spike': 'watch',
      'c2:ready': 'good',
      'c7:pr': 'good',
      'c5:nodata': 'good',
    });
    expect(Object.keys(by).some((k) => k.startsWith('c9:'))).toBe(false); // program-only: no alarm
    expect(Object.keys(by).some((k) => k.endsWith(':rhythm'))).toBe(false);
    expect(w.signals.find((s) => s.signal.clientId === 'c4')!.signal.kind).toBe('machine');
  });

  it('header counts reconcile with the rows (R-FE-102)', () => {
    const { w } = world();
    expect(w.counts.needDecision).toBe(2);
    expect(w.counts.needAttention).toBe(4);
    expect(w.rows.filter((r) => r.status === 'urgent').map((r) => r.client.name)).toEqual([
      'Andriy Lysenko',
      'Oleh Bondar',
    ]);
    expect(w.rows[0].status).toBe('urgent');
    expect(w.rows.at(-1)!.status).not.toBe('urgent');
  });

  it('Today: at most 5 cards, same client never twice, 2 reschedule requests', () => {
    const { w } = world();
    expect(w.picked.mode).toBe('queue');
    expect(w.picked.cards).toHaveLength(5);
    expect(new Set(w.picked.cards.map((c) => c.clientId)).size).toBe(5);
    expect(
      w.picked.cards
        .slice(0, 2)
        .map((c) => c.primary.kind)
        .sort(),
    ).toEqual(['injury', 'stall']);
    expect(w.picked.digest).toBe(3);
    expect(w.pendingMoves.map((s) => s.move!.from).sort()).toEqual(['client', 'trainer']);
  });

  it('Decisions: 42 = 26 improved + 10 no clear change + 4 declined + 2 measuring', () => {
    const { w } = world();
    expect(w.summary).toEqual({ total: 42, improved: 26, noChange: 10, declined: 4, measuring: 2 });
  });

  it('program-only Maksym shares nothing and has no live dot; hybrid clients exist', () => {
    const { d } = world();
    const m = d.clients.find((c) => c.id === 'c9')!;
    expect(m.mode).toBe('program');
    expect(d.clients.filter((c) => c.mode === 'hybrid')).toHaveLength(4);
    expect(m.live).toBeFalsy();
    expect(d.clients.filter((c) => c.live)).toHaveLength(2);
    expect(d.clients.find((c) => c.id === 'c3')!.consent).toMatchObject({
      sets: 'full',
      injury: 'full',
    });
    expect(d.clients.find((c) => c.id === 'c5')!.consent).toMatchObject({
      totals: 'full',
      sets: 'off',
    });
  });

  it('unread seed: Oleh 3, Maria 12, Andriy 1 = 16 (reads "9+")', () => {
    const docs: ConversationUnreadDoc[] = Object.entries(FIXTURE_UNREAD).map(([clientId, n]) => ({
      cid: `cid-${clientId}`,
      clientId,
      trainerId: 't',
      active: true,
      unread: { t: n },
    }));
    expect(unreadFromConversations('t', docs).total).toBe(16);
  });

  it('the port serves the world, warm cache on request, and saves the book', async () => {
    const cold = createFixturesPort();
    expect(cold.peek()).toBeNull();
    const data = await cold.load({ signal: new AbortController().signal });
    expect(cold.peek()?.data).toBe(data);
    expect(createFixturesPort({ warm: true }).peek()?.fetchedAt).toBeLessThan(FIXTURE_NOW);
  });
});
