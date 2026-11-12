import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import type { ClientAvailability } from '../domain/availability';
import { configureAvailability } from '../data/availability';
import { setCoachTimeZone } from '../format';
import { RequestChecks } from './RequestChecks';
import type { RescheduleRequest, ScheduleSlot } from './types';

const DAY = 86_400_000;
const D0 = 20_000 * DAY; // some UTC midnight
const at = (h: number) => D0 + h * 3_600_000;
const slot = (id: string, h: number, extra: Partial<ScheduleSlot> = {}) =>
  ({ id, key: id, start: at(h), durationMin: 60, status: 'planned', ...extra }) as ScheduleSlot;
const req = (h: number): RescheduleRequest => ({
  id: 'r1',
  clientId: 'c1',
  from: 'client',
  slotKey: 's1',
  fromStart: at(8),
  toStart: at(h),
  status: 'pending',
  createdAt: 0,
  expiresAt: at(99),
  scope: 'all',
});
const FREE: ClientAvailability = {
  weekly: {
    0: [[600, 900]],
    1: [[600, 900]],
    2: [[600, 900]],
    3: [[600, 900]],
    4: [[600, 900]],
    5: [[600, 900]],
    6: [[600, 900]],
  },
  unavailable: [],
};

const show = (h: number, others: ScheduleSlot[] = []) =>
  render(
    <RequestChecks
      request={req(h)}
      slot={slot('s1', 8)}
      slots={[slot('s1', 8), ...others]}
      name="Anna"
      t={t}
    />,
  );

beforeEach(() => setCoachTimeZone('UTC'));
afterEach(() => {
  cleanup();
  configureAvailability(null);
});

describe('RequestChecks (trainer, session request)', () => {
  it('inside the free hours: ticked', async () => {
    configureAvailability({ read: async () => ({ state: 'shared', availability: FREE }) });
    show(11);
    expect(await screen.findByText(t.rcChkFree('Anna'))).toBeTruthy();
    expect(screen.getByText(t.rcChkNoClash)).toBeTruthy();
  });
  it('outside the free hours (also when only part of it fits): warned', async () => {
    configureAvailability({ read: async () => ({ state: 'shared', availability: FREE }) });
    show(14.5);
    expect(await screen.findByText(t.rcChkNotFree('Anna'))).toBeTruthy();
  });
  it('not shared / failed read: no free-hours row at all, the clash row stays', async () => {
    configureAvailability({ read: async () => ({ state: 'not-shared' }) });
    show(11);
    await waitFor(() => expect(screen.getByText(t.rcChkNoClash)).toBeTruthy());
    expect(screen.queryByText(t.rcChkFree('Anna'))).toBeNull();
    expect(screen.queryByText(t.rcChkNotFree('Anna'))).toBeNull();
    cleanup();
    configureAvailability({ read: async () => Promise.reject(new Error('x')) });
    show(11);
    expect(screen.getByText(t.rcChkNoClash)).toBeTruthy();
    expect(screen.queryByText(t.rcChkNotFree('Anna'))).toBeNull();
  });
  it('another session at that time: overlap; a moved one and its own old place do not count', async () => {
    show(11, [slot('o', 11.5)]);
    expect(screen.getByText(t.rcChkClash)).toBeTruthy();
    cleanup();
    show(11, [slot('o', 11.5, { status: 'moved' })]);
    expect(screen.getByText(t.rcChkNoClash)).toBeTruthy();
    cleanup();
    show(8.5); // overlaps only its own current place
    expect(screen.getByText(t.rcChkNoClash)).toBeTruthy();
  });
  it('a session crossing midnight is never "inside the free hours"', async () => {
    configureAvailability({ read: async () => ({ state: 'shared', availability: FREE }) });
    show(23.5);
    expect(await screen.findByText(t.rcChkNotFree('Anna'))).toBeTruthy();
  });
});
