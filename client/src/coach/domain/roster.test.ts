// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ALL_OFF, askable, effectiveConsent, sharingSummary } from './consent';
import { buildRoster, countRoster, statusOf } from './roster';
import { attendeesOf, headcount, pendingMoves, sharedView } from './slots';
import type { CoachClient, Severity, Signal, Slot } from './types';
import { NOW, consent } from './testBuilders';

const client = (id: string, o: Partial<CoachClient> = {}): CoachClient => ({
  id,
  name: id.toUpperCase(),
  goal: '',
  program: '',
  programWeek: 1,
  gym: '',
  mode: 'app',
  consent: consent(),
  streakWeeks: 0,
  planned: 3,
  done: 1,
  lastSessionAt: null,
  trainerDays: [],
  ...o,
});
const sig = (clientId: string, severity: Severity): Signal => ({
  key: `${clientId}|x|`,
  clientId,
  kind: 'spike',
  severity,
  confidence: 'high',
  strength: 1,
  exerciseKey: null,
  detectedAt: NOW,
  facts: {},
  evidence: [],
});

describe('roster', () => {
  it('status is the worst open signal; none without signals', () => {
    expect(statusOf([sig('a', 'good'), sig('a', 'urgent')])).toBe('urgent');
    expect(statusOf([sig('a', 'good'), sig('a', 'watch')])).toBe('watch');
    expect(statusOf([sig('a', 'good')])).toBe('good');
    expect(statusOf([])).toBe('none');
  });
  it('needs attention first, pending invites last, counts reconcile', () => {
    const cs = [
      client('d'),
      client('c', { done: 2 }),
      client('b'),
      client('a', { invite: { sentAt: NOW, expiresAt: NOW }, planned: 9, done: 9 }),
    ];
    const rows = buildRoster(cs, [sig('c', 'urgent'), sig('b', 'watch')]);
    expect(rows.map((r) => r.client.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(rows.map((r) => r.status)).toEqual(['urgent', 'watch', 'none', 'none']);
    expect(countRoster(rows)).toEqual({
      clients: 3,
      needAttention: 2,
      needDecision: 1,
      weekDone: 4,
      weekPlanned: 9,
      live: 0,
      pendingInvites: 1,
    });
  });
});

describe('consent helpers', () => {
  it('program clients are forced off and cannot be asked', () => {
    const full = consent({ totals: 'full', sets: 'full' });
    expect(effectiveConsent('program', full)).toBe(ALL_OFF);
    expect(effectiveConsent('app', full)).toBe(full);
    expect(askable('program', full)).toEqual([]);
    expect(askable('app', full)).not.toContain('totals');
    expect(askable('app', full)).toContain('injury');
  });
  it('sharing summary', () => {
    expect(sharingSummary(consent({ totals: 'full', sets: 'full', injury: 'effects' }))).toBe(
      'sets+injury',
    );
    expect(sharingSummary(consent({ totals: 'full', sets: 'full' }))).toBe('sets');
    expect(sharingSummary(consent({ totals: 'full' }))).toBe('totals');
    expect(sharingSummary(consent())).toBe('none');
  });
});

describe('slots', () => {
  const group: Slot = {
    id: 'g',
    clientId: 'a',
    kind: 'group',
    title: 'Mobility class',
    capacity: 8,
    start: NOW,
    durationMin: 45,
    gymId: 'g',
    status: 'planned',
    attendees: [
      { clientId: 'a', status: 'planned' },
      { clientId: 'b', status: 'declined' },
      { clientId: 'c', status: 'planned' },
    ],
  };
  it('headcount skips declined; a client sees the count, never names', () => {
    expect(headcount(group)).toBe(2);
    expect(sharedView(group)).toEqual({
      kind: 'group',
      title: 'Mobility class',
      people: 2,
      capacity: 8,
    });
    expect(JSON.stringify(sharedView(group))).not.toContain('"b"');
  });
  it('a solo slot without attendees falls back to its client', () => {
    expect(attendeesOf({ ...group, attendees: [] })).toEqual([
      { clientId: 'a', status: 'planned' },
    ]);
  });
  it('pending moves, oldest first', () => {
    const mv = (id: string, start: number): Slot => ({
      ...group,
      id,
      start,
      status: 'pending-move',
      move: { reqId: id, from: 'client', start },
    });
    expect(pendingMoves([mv('b', 2), group, mv('a', 1)]).map((s) => s.id)).toEqual(['a', 'b']);
  });
});
