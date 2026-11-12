import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { configureAvailability } from '../data/availability';
import type { ClientAvailability } from '../domain/availability';
import { setCoachTimeZone } from '../format';
import { FreeHoursNotice } from './FreeHoursNotice';

const DAY = 86_400_000;
const at = (h: number) => 20_000 * DAY + h * 3_600_000;
const draft = (h: number, durationMin = 60) => ({ start: at(h), durationMin, gymId: 'g' });
const R: [number, number][] = [[600, 900]];
const FREE: ClientAvailability = {
  weekly: { 0: R, 1: R, 2: R, 3: R, 4: R, 5: R, 6: R },
  unavailable: [],
};
const mount = (drafts: ReturnType<typeof draft>[], clientId: string | null = 'c1') =>
  render(<FreeHoursNotice clientId={clientId} drafts={drafts} name="Anna" t={t} />);

beforeEach(() => setCoachTimeZone('UTC'));
afterEach(() => {
  cleanup();
  configureAvailability(null);
});

describe('FreeHoursNotice (session form)', () => {
  it('outside the free hours: one calm warning', async () => {
    configureAvailability({ read: async () => ({ state: 'shared', availability: FREE }) });
    mount([draft(18)]);
    expect(await screen.findByText(t.rcChkNotFree('Anna'))).toBeTruthy();
  });
  it('inside: nothing', async () => {
    let n = 0;
    configureAvailability({
      read: async () => (n++, { state: 'shared', availability: FREE }),
    });
    const { container } = mount([draft(11)]);
    await waitFor(() => expect(n).toBe(1));
    await Promise.resolve();
    expect(container.textContent).toBe('');
  });
  it('a series: says how many are outside', async () => {
    configureAvailability({ read: async () => ({ state: 'shared', availability: FREE }) });
    mount([draft(11), draft(18), draft(19)]);
    expect(await screen.findByText(t.rcChkNotFreeN('Anna', 2))).toBeTruthy();
  });
  it('not shared, a failed read, no client or several clients: nothing and no read', async () => {
    configureAvailability({ read: async () => ({ state: 'not-shared' }) });
    const a = mount([draft(18)]);
    await Promise.resolve();
    expect(a.container.textContent).toBe('');
    a.unmount();
    configureAvailability({ read: () => Promise.reject(new Error('x')) });
    const b = mount([draft(18)]);
    await Promise.resolve();
    expect(b.container.textContent).toBe('');
    b.unmount();
    let reads = 0;
    configureAvailability({ read: async () => (reads++, { state: 'shared', availability: FREE }) });
    const c = mount([draft(18)], null);
    await Promise.resolve();
    expect(c.container.textContent).toBe('');
    expect(reads).toBe(0);
  });
});
