import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduleDigestEn as t } from '../../../i18n/coachScheduleDigest.en';
import { createFixturesPort } from '../../data/__fixtures__/fixtures';
import type { CoachClient, Consent } from '../../domain/types';
import { setViewport } from '../../testViewport';
import { createFixturesSchedulePort } from '../__fixtures__/fixtures';
import { WeekScreen } from '../WeekScreen';
import type { RescheduleRequest, ScheduleSlot } from '../types';
import { digestIsEmpty, weekDigest } from './weekDigest';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#/c/week');
});
beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/week');
});

const DAY = 24 * 3_600_000;
const consent = (totals: Consent['totals']): Consent => ({
  totals,
  sets: 'off',
  body: 'off',
  sleep: 'off',
  injury: 'off',
  nutrition: 'off',
  checkins: 'off',
});
const client = (id: string, totals: Consent['totals']) =>
  ({ id, consent: consent(totals) }) as unknown as CoachClient;
const slot = (id: string, clientId: string, dayOffset: number, status: ScheduleSlot['status']) =>
  ({
    id,
    key: id,
    clientId,
    attendees: [{ clientId, status }],
    start: 20 * DAY + dayOffset * DAY + 9 * 3_600_000,
    durationMin: 60,
    status,
  }) as unknown as ScheduleSlot;

describe('weekDigest (pure)', () => {
  const days = [20, 21, 22, 23, 24, 25, 26];
  const byId = new Map([client('a', 'effects'), client('b', 'off')].map((c) => [c.id, c]));
  it('counts only the sessions of clients who share totals, and says how many were left out', () => {
    const d = weekDigest({
      days,
      slots: [slot('1', 'a', 0, 'done'), slot('2', 'a', 1, 'planned'), slot('3', 'b', 2, 'done')],
      requests: [],
      byId,
      now: 20 * DAY,
      openDecisions: 2,
    });
    expect(d).toEqual({ planned: 2, done: 1, hidden: 1, moves: 0, decisions: 2 });
  });
  it('counts waiting requests of this week, not answered ones or other weeks', () => {
    const rq = (id: string, status: RescheduleRequest['status'], day: number) =>
      ({
        id,
        status,
        fromStart: day * DAY + 9 * 3_600_000,
        expiresAt: 99 * DAY,
      }) as unknown as RescheduleRequest;
    const d = weekDigest({
      days,
      slots: [],
      requests: [rq('x', 'pending', 21), rq('y', 'accepted', 21), rq('z', 'pending', 30)],
      byId,
      now: 20 * DAY,
      openDecisions: null,
    });
    expect(d.moves).toBe(1);
    expect(d.decisions).toBeNull();
  });
  it('moved-away ghosts are not sessions; an empty week is empty', () => {
    const d = weekDigest({
      days,
      slots: [slot('g', 'a', 0, 'moved')],
      requests: [],
      byId,
      now: 20 * DAY,
      openDecisions: 0,
    });
    expect(digestIsEmpty(d)).toBe(true);
  });
});

describe('Week page digest strip', () => {
  it('shows done of planned, waiting moves and open decisions from the fixtures world', async () => {
    render(
      <WeekScreen
        onNavigate={() => undefined}
        port={createFixturesSchedulePort()}
        worldPort={createFixturesPort({ warm: true })}
      />,
    );
    const strip = await screen.findByRole('group', { name: t.wdLabel });
    expect(within(strip).getByText(t.wdMoves)).toBeTruthy();
    expect(within(strip).getByText(t.wdDecisions)).toBeTruthy();
    expect(within(strip).getByText(/^\d+\/\d+$/)).toBeTruthy();
  });
  it('another week has no decisions cell (a signal has no week)', async () => {
    window.history.replaceState(null, '', '#/c/week?d=1');
    render(
      <WeekScreen
        onNavigate={() => undefined}
        port={createFixturesSchedulePort()}
        worldPort={createFixturesPort({ warm: true })}
      />,
    );
    await screen.findByText(/sessions done/);
    expect(screen.queryByText(t.wdDecisions)).toBeNull();
  });
});
