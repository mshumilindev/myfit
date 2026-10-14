import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { setCoachTimeZone } from '../format';
import { configureCalendarSettings, createMemoryCalendarSettingsPort } from './calendarSettings';
import { defaultSettings } from './hours';
import { HoursNotice } from './HoursNotice';
import { tsOf, weekStartDay } from './time';

const MON = weekStartDay(20_000);
const at = (dow: number, h: number, gymId: string, durationMin = 60) => ({
  start: tsOf(MON + dow, h * 60),
  durationMin,
  gymId,
});

beforeEach(() => {
  setLocale('en');
  setCoachTimeZone('Europe/Kyiv');
  configureCalendarSettings(
    createMemoryCalendarSettingsPort({ ...defaultSettings(), gymIds: ['iron-yard'] }),
  );
});
afterEach(() => {
  cleanup();
  configureCalendarSettings(null);
  setCoachTimeZone('UTC');
});

describe('HoursNotice', () => {
  it('says nothing inside working and gym hours', async () => {
    render(<HoursNotice drafts={[at(0, 10, 'iron-yard')]} t={t} />);
    await waitFor(() => undefined);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('names the working-hours reason for a 23:00 session at a 24/7 gym', async () => {
    render(<HoursNotice drafts={[at(1, 22, 'fithub')]} t={t} />);
    expect((await screen.findByRole('status')).textContent).toContain(t.hsOutsideWork);
  });
  it('names the gym when it is closed then (Iron Yard Sunday evening)', async () => {
    render(<HoursNotice drafts={[at(6, 21, 'iron-yard')]} t={t} />);
    const s = await screen.findByRole('status');
    expect(s.textContent).toContain('Iron Yard');
  });
  it('counts a series', async () => {
    render(<HoursNotice drafts={[at(0, 5, 'fithub'), at(1, 5, 'fithub')]} t={t} />);
    expect((await screen.findByRole('status')).textContent).toContain(t.hsOutsideN(2));
  });
});
