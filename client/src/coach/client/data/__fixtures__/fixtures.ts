/**
 * In-memory adapter behind `ClientCoachPort` (stories, tests, the dev server). Behaves like the server contract:
 * accept writes grants, a downgrade is immediate, revoke keeps the relationship, nothing is persisted anywhere.
 * Scenarios are the states of S-25 .. S-34.
 */
import { FIXTURE_NOW } from '../../../data/__fixtures__/fixtures';
import { ALL_OFF } from '../../../domain/consent';
import type { Consent, Dow } from '../../../domain/types';
import { presetConsent, revokedConsent } from '../../domain';
import type { ClientCoachPort } from '../port';
import {
  ClientPortError,
  type AccessEntry,
  type ClientLink,
  type ClientSnapshot,
  type InviteInfo,
  type ProgramLayer,
  type TrainerInfo,
} from '../types';

const DAY = 86_400_000;
const at = (dayOffset: number, h: number, m: number) => Date.UTC(2026, 9, 7 + dayOffset, h, m);

export const FIXTURE_TRAINER: TrainerInfo = {
  id: 'trainer-iryna',
  name: 'Iryna Melnyk',
  org: 'Iron Yard, Kyiv',
  since: Date.UTC(2026, 5, 2),
};

export type ClientScenario = 'none' | 'active' | 'waiting' | 'revoked' | 'no-program' | 'migrated';

const PROGRAM: ProgramLayer = {
  version: 5,
  updatedAt: at(0, 17, 40),
  summary: 'New targets, 2 changes in Upper A and Upper B',
  acked: false,
  trainerDays: ['Tue', 'Fri'],
  targets: {
    'Barbell Squat': { sets: 4, reps: 5, kg: 120, rpe: 8, restSec: 150 },
    'Romanian Deadlift': { sets: 3, reps: 8, kg: 100, rpe: 7, restSec: 120 },
    'Leg Press': { sets: 3, reps: 12, kg: 200, rpe: 8, restSec: 120 },
    'Standing Calf Raise': { sets: 4, reps: 12, kg: 80, rpe: 8, restSec: 60 },
    'Paused Bench Press': {
      sets: 3,
      reps: 6,
      kg: 82.5,
      rpe: 8,
      restSec: 150,
      note: 'Two second pause on the chest. Keep the shoulder blades tight.',
    },
  },
  activities: [
    { id: 'a1', day: 2, name: 'Easy run', minutes: 30, when: 'after' },
    { id: 'a2', day: 5, name: 'Mobility', minutes: 15, when: 'after' },
  ],
};

export const FIXTURE_ACCESS: readonly AccessEntry[] = [
  { id: 'r1', at: at(0, 8, 27), category: 'sleep', what: 'summary' },
  { id: 'r2', at: at(0, 8, 24), category: 'totals', what: 'week' },
  { id: 'r3', at: at(-1, 9, 20), category: 'sets', what: 'session', ref: 'Tue 6 Oct' },
  { id: 'r4', at: at(-1, 9, 18), category: 'sets', what: 'history', ref: 'Bench press' },
  { id: 'r5', at: at(-1, 9, 5), category: 'totals', what: 'week' },
  { id: 'r6', at: at(-2, 18, 2), category: 'sets', what: 'live' },
];

export function fixtureInvite(token: string, now = FIXTURE_NOW): InviteInfo {
  const base = {
    token,
    trainerName: FIXTURE_TRAINER.name,
    org: FIXTURE_TRAINER.org,
  };
  if (token.startsWith('expired')) return { ...base, state: 'expired', expiresAt: now - 7 * DAY };
  if (token.startsWith('used')) return { ...base, state: 'used', expiresAt: now + 3 * DAY };
  if (token.startsWith('declined')) return { ...base, state: 'declined', expiresAt: now + 3 * DAY };
  return { ...base, state: 'valid', expiresAt: now + 7 * DAY };
}

function linkFor(s: ClientScenario): ClientLink {
  const mine = { clientId: 'c1', cid: 'cid-c1' };
  if (s === 'none')
    return { state: 'none', trainer: null, grants: ALL_OFF, ...mine, lastSeenAt: null, cid: null };
  const state = s === 'waiting' ? 'waiting' : s === 'revoked' ? 'revoked' : 'active';
  return {
    state,
    trainer: FIXTURE_TRAINER,
    grants: s === 'revoked' || s === 'migrated' ? revokedConsent() : presetConsent('recovery'),
    ...mine,
    lastSeenAt: at(0, 8, 41),
    // linked before the consent model: the legacy trainer pointer was adopted, nothing is shared yet
    ...(s === 'migrated' ? { migrated: true } : {}),
  };
}

export interface FixturesClientOptions {
  scenario?: ClientScenario;
  delayMs?: number;
  /** every network-ish call rejects with this */
  fail?: 'offline' | 'unavailable';
  now?: () => number;
}

export function createFixturesClientPort(opts: FixturesClientOptions = {}): ClientCoachPort & {
  /** tests: the current state */
  state(): ClientSnapshot;
  /** tests: the trainer app finishes the key exchange */
  turnSharingOn(): void;
} {
  const now = opts.now ?? (() => FIXTURE_NOW);
  const scenario = opts.scenario ?? 'none';
  let snap: ClientSnapshot = {
    link: linkFor(scenario),
    program: scenario === 'none' || scenario === 'no-program' ? null : PROGRAM,
    selfCoachDays: scenario === 'none' ? ['Tue', 'Fri'] : [],
    asOf: now(),
  };
  const subs = new Set<(s: ClientSnapshot) => void>();
  const emit = (patch: Partial<ClientSnapshot>) => {
    snap = { ...snap, ...patch, asOf: now() };
    subs.forEach((f) => f(snap));
  };
  const gate = async () => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.fail) throw new ClientPortError(opts.fail);
  };
  return {
    now,
    state: () => snap,
    peek: () => snap,
    subscribe(on) {
      subs.add(on);
      on(snap);
      return () => void subs.delete(on);
    },
    async getInvite(token) {
      await gate();
      return fixtureInvite(token, now());
    },
    async acceptInvite(token, grants) {
      await gate();
      const inv = fixtureInvite(token, now());
      if (inv.state !== 'valid') throw new ClientPortError('not-found', inv.state);
      emit({
        link: {
          state: 'waiting',
          trainer: FIXTURE_TRAINER,
          grants,
          clientId: 'c1',
          cid: 'cid-c1',
          lastSeenAt: null,
        },
        program: null,
      });
    },
    async declineInvite() {
      await gate();
    },
    async setLevel(category, level) {
      await gate();
      emit({ link: { ...snap.link, grants: { ...snap.link.grants, [category]: level } } });
    },
    async revoke() {
      await gate();
      const previous = snap.link.grants;
      emit({ link: { ...snap.link, state: 'revoked', grants: revokedConsent() } });
      return { previous };
    },
    async restore(previous: Consent) {
      await gate();
      emit({ link: { ...snap.link, state: 'active', grants: previous } });
    },
    async leave() {
      await gate();
      emit({ link: linkFor('none'), program: null });
    },
    async team() {
      await gate();
      const h = 3_600_000;
      return {
        trainerName: 'Olena Kovalenko',
        members: [
          { name: 'Irina Melnyk', role: 'manager' as const },
          { name: 'Andriy Petrenko', role: 'trainer' as const },
          { name: 'Olena Kovalenko', role: 'trainer' as const },
        ],
        actions: [
          { id: 'a1', kind: 'move-request', actorName: 'Irina Melnyk', ts: Date.now() - 2 * h },
          { id: 'a2', kind: 'session-done', actorName: 'Irina Melnyk', ts: Date.now() - 30 * h },
        ],
      };
    },
    async accessLog() {
      await gate();
      return [...FIXTURE_ACCESS];
    },
    async ackProgram(version) {
      await gate();
      if (snap.program?.version === version) emit({ program: { ...snap.program, acked: true } });
    },
    async setSelfCoachDays(days) {
      await gate();
      emit({ selfCoachDays: days as readonly Dow[] });
    },
    turnSharingOn() {
      if (snap.link.state === 'waiting')
        emit({ link: { ...snap.link, state: 'active' }, program: PROGRAM });
    },
  };
}
