/**
 * The member-side bridge: what the eager app (nav badge, Today tile, calendar markers, notification rows) learns about
 * my trainer, and that nothing is published without one. Real stores, fixture ports (the Firebase boundary is not involved).
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const overlay = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock('../../data/programMine', async (orig) => {
  const actual = await orig<typeof import('../../data/programMine')>();
  return { ...actual, setProgramOverlay: (f: unknown) => void overlay.calls.push(f) };
});

import { clientEn as cc } from '../../i18n/coachClient.en';
import { dayOfTimestamp } from '../../components/ui/calendarDays';
import { FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { createFixturesSchedulePort, scheduleSeed } from '../schedule/__fixtures__/fixtures';
import { configureSchedule } from '../schedule/useSchedule';
import type { RescheduleRequest } from '../schedule/types';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort } from './data/__fixtures__/fixtures';
import { configureClientCoach } from './data/config';
import type { ClientCoachPort } from './data/port';
import type { ClientSnapshot } from './data/types';
import { ClientBridge } from './ClientBridge';
import { getClientShared, publishClientShared } from './shared';

beforeEach(() => {
  overlay.calls.length = 0;
  publishClientShared(null);
});
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureSchedule(null);
  publishClientShared(null);
});

const req = (id: string, over: Partial<RescheduleRequest>): RescheduleRequest => ({
  id,
  clientId: 'c1',
  from: 'trainer',
  slotKey: 'sk_x',
  fromStart: FIXTURE_NOW,
  toStart: FIXTURE_NOW + 86_400_000,
  status: 'pending',
  createdAt: FIXTURE_NOW - 5000,
  expiresAt: FIXTURE_NOW + 86_400_000,
  scope: 'all',
  ...over,
});
const schedule = (requests: RescheduleRequest[] = []) => {
  const seed = scheduleSeed();
  return createFixturesSchedulePort({ seed: { ...seed, requests }, now: () => FIXTURE_NOW });
};
const setup = (
  opts: { link?: ClientCoachPort; requests?: RescheduleRequest[]; unread?: number } = {},
) => {
  configureClientCoach({
    port: opts.link ?? createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW }),
    chat: createFixturesClientChatPort({ unread: opts.unread ?? 3 }),
  });
  configureSchedule(schedule(opts.requests));
  return render(<ClientBridge />);
};

describe('ClientBridge', () => {
  it('renders nothing', () => {
    const { container } = setup();
    expect(container.innerHTML).toBe('');
  });

  it('without a trainer it publishes the empty state', async () => {
    publishClientShared({ hasTrainer: true, trainerFirst: 'Stale', unread: 9 });
    setup({ link: createFixturesClientPort({ scenario: 'none' }) });
    await vi.waitFor(() => expect(getClientShared().hasTrainer).toBe(false));
    expect(getClientShared()).toMatchObject({ trainerFirst: '', unread: 0, notifs: [] });
    expect(getClientShared().trainerDays.size).toBe(0);
  });

  it('with an active trainer: first name, unread number and label, marker words, the days of my sessions', async () => {
    setup();
    await vi.waitFor(() => expect(getClientShared().hasTrainer).toBe(true));
    await vi.waitFor(() => expect(getClientShared().unread).toBe(3));
    const s = getClientShared();
    expect(s).toMatchObject({
      trainerFirst: 'Iryna',
      unreadLabel: cc.ccUnreadAria(3),
      markerLegend: cc.calMarkerLegend,
      markerDay: cc.calMarkerDay('Iryna'),
    });
    expect(s.trainerDays.size).toBeGreaterThan(0);
    // c1 (this member) trains on Fridays in the seed week: Friday 9 Oct 2026 is marked
    expect(s.trainerDays.has(dayOfTimestamp(Date.UTC(2026, 9, 9, 18, 0)))).toBe(true);
    // Saturday has no session of c1's in the seed
    expect(s.trainerDays.has(dayOfTimestamp(Date.UTC(2026, 9, 10, 18, 0)))).toBe(false);
  });

  it('notification rows: new messages, an unacknowledged program, a request from the trainer, an answer to mine; each with its target', async () => {
    setup({
      requests: [
        req('t1', { from: 'trainer', note: 'Gym closed' }),
        req('a1', {
          from: 'client',
          status: 'accepted',
          decidedAt: FIXTURE_NOW - 1000,
          note: 'Thanks',
        }),
        req('d1', { from: 'client', status: 'declined', decidedAt: FIXTURE_NOW - 900 }),
        req('p1', { from: 'client', status: 'pending' }),
        req('x1', { from: 'trainer', status: 'pending', expiresAt: FIXTURE_NOW - 1 }),
        req('o1', { from: 'trainer', clientId: 'someone-else' }),
        req('c1', { from: 'trainer', status: 'cancelled' }),
      ],
    });
    await vi.waitFor(() => expect(getClientShared().notifs.length).toBe(5));
    const by = Object.fromEntries(getClientShared().notifs.map((n) => [n.id, n]));
    expect(Object.keys(by).sort()).toEqual(
      [
        'trainer:msg:3',
        'trainer:program:5',
        'trainer:rq:t1',
        'trainer:rqa:a1',
        'trainer:rqa:d1',
      ].sort(),
    );
    expect(by['trainer:msg:3']).toMatchObject({
      kind: 'trainer',
      title: cc.nfMessage('Iryna'),
      nav: '#/trainer/chat',
    });
    expect(by['trainer:program:5']).toMatchObject({
      title: cc.nfProgram('Iryna'),
      nav: '#/programs',
    });
    expect(by['trainer:rq:t1']).toMatchObject({
      title: cc.nfResched('Iryna'),
      subtitle: 'Gym closed',
      ts: FIXTURE_NOW - 5000,
    });
    expect(by['trainer:rqa:a1']).toMatchObject({
      title: cc.nfReschedAnswer('Iryna'),
      subtitle: 'Thanks',
      ts: FIXTURE_NOW - 1000,
    });
    expect(by['trainer:rqa:d1'].subtitle).toBe('');
  });

  it('no unread messages and an acknowledged program add no rows', async () => {
    const link = createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW });
    await link.ackProgram(5);
    setup({ link, unread: 0 });
    await vi.waitFor(() => expect(getClientShared().hasTrainer).toBe(true));
    expect(getClientShared().notifs).toEqual([]);
    expect(getClientShared().unread).toBe(0);
  });

  it('a revoked link still counts as having a trainer; waiting too', async () => {
    setup({ link: createFixturesClientPort({ scenario: 'revoked', now: () => FIXTURE_NOW }) });
    await vi.waitFor(() => expect(getClientShared().hasTrainer).toBe(true));
  });

  it('unmounting clears what was published', async () => {
    const { unmount } = setup();
    await vi.waitFor(() => expect(getClientShared().hasTrainer).toBe(true));
    unmount();
    expect(getClientShared().hasTrainer).toBe(false);
    expect(getClientShared().notifs).toEqual([]);
  });

  describe('the trainer layer over the program', () => {
    const withProgram = (): ClientCoachPort => {
      const base = createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW });
      const snap: ClientSnapshot = {
        ...base.state(),
        program: {
          ...base.state().program!,
          acked: true,
          program: {
            items: [
              {
                id: 'i1',
                targetWeight: 100,
                targetRpe: 8,
                restSec: 90,
                note: 'Pause',
                kind: 'strength',
              },
            ],
            activities: [],
          } as never,
        },
      };
      return { ...base, peek: () => snap, subscribe: (on) => (on(snap), () => undefined) };
    };

    it('installs an overlay that adds the sealed targets to the runnable program and removes it on unmount', async () => {
      const { unmount } = setup({ link: withProgram() });
      await vi.waitFor(() => expect(overlay.calls.some((c) => typeof c === 'function')).toBe(true));
      const f = overlay.calls.filter((c) => typeof c === 'function').at(-1) as (p: unknown) => {
        items: Array<Record<string, unknown>>;
      };
      const out = f({
        items: [
          { id: 'i1', name: 'Squat' },
          { id: 'other', name: 'Row' },
        ],
      });
      expect(out.items[0]).toMatchObject({
        id: 'i1',
        targetWeight: 100,
        targetRpe: 8,
        restSec: 90,
        note: 'Pause',
      });
      expect(out.items[1]).toEqual({ id: 'other', name: 'Row' });
      unmount();
      expect(overlay.calls.at(-1)).toBeNull();
    });

    it('without the runnable program (or a trainer) no overlay is installed', async () => {
      setup();
      await vi.waitFor(() => expect(getClientShared().hasTrainer).toBe(true));
      expect(overlay.calls.filter((c) => typeof c === 'function')).toEqual([]);
      act(() => undefined);
    });
  });
});
