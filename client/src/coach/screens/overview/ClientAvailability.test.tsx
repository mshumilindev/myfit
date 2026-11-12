import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rosterEn as r } from '../../../i18n/coachRoster.en';
import type { AvailabilityView } from '../../data/availability';
import { dayKeyOf, type ClientAvailability } from '../../domain/availability';
import { busyText, ClientAvailabilityCard } from './ClientAvailability';

afterEach(cleanup);

const TODAY = dayKeyOf(Date.UTC(2026, 10, 12)); // Thu 12 Nov 2026
const AV: ClientAvailability = {
  weekly: {
    0: [
      [360, 480],
      [1080, 1260],
    ],
    5: [[540, 780]],
  },
  unavailable: [{ fromDay: TODAY, toDay: TODAY + 3 }],
};
const show = (
  view: AvailabilityView,
  over: Partial<Parameters<typeof ClientAvailabilityCard>[0]> = {},
) => {
  const onShow = vi.fn();
  const onPropose = vi.fn();
  render(
    <ClientAvailabilityCard
      view={view}
      first="Oleh"
      r={r}
      locale="en"
      today={TODAY}
      onShow={onShow}
      onPropose={onPropose}
      {...over}
    />,
  );
  return { onShow, onPropose };
};

describe('free hours card', () => {
  it('draws nothing while loading or when nothing is shared (the sharing list already says "Not shared")', () => {
    show({ state: 'loading' });
    show({ state: 'not-shared' });
    expect(document.body.textContent).toBe('');
  });

  it('shared: a heading with the name, seven days with their hours as text and a bar, "none" for the empty days', () => {
    show({ state: 'shared', availability: AV });
    expect(screen.getByRole('heading', { name: r.c3AvTitle('Oleh') })).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(7); // one bar per day, each with a spoken label
    expect(screen.getByText('06:00–08:00 · 18:00–21:00')).toBeTruthy();
    expect(screen.getByText('09:00–13:00')).toBeTruthy();
    expect(screen.getAllByText(r.c3AvNone)).toHaveLength(5); // the five empty days
    expect(screen.getByRole('img', { name: r.c3AvFree('06:00–08:00 · 18:00–21:00') })).toBeTruthy();
  });

  it('a not-available span is shown as busy days with no reason, and a span that is over is not', () => {
    show({
      state: 'shared',
      availability: {
        ...AV,
        unavailable: [...AV.unavailable, { fromDay: TODAY - 9, toDay: TODAY - 5 }],
      },
    });
    expect(screen.getByText('Busy Thu, Nov 12 – Sun, Nov 15')).toBeTruthy();
    expect(screen.getAllByText(r.c3AvBusyNote())).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/Unwell|injur|rest/i);
  });

  it('no hours at all: one plain line instead of seven empty rows', () => {
    show({ state: 'shared', availability: { weekly: {}, unavailable: [] } });
    expect(screen.getByText(r.c3AvNoHours())).toBeTruthy();
    expect(screen.queryByText(r.c3AvNone)).toBeNull();
  });

  it('two actions: Show on Schedule and Propose a session', () => {
    const { onShow, onPropose } = show({ state: 'shared', availability: AV });
    fireEvent.click(screen.getByRole('button', { name: r.c3AvShow }));
    fireEvent.click(screen.getByRole('button', { name: r.c3AvPropose }));
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onPropose).toHaveBeenCalledTimes(1);
  });

  it('failed: says so and Try again retries', () => {
    const retry = vi.fn();
    show({ state: 'failed', retry });
    const card = screen.getByRole('heading', { name: r.c3AvTitle('Oleh') }).closest('section')!;
    expect(within(card).getByText(r.c3AvFailed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: r.c3AvRetry }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: r.c3AvShow })).toBeNull();
  });
});

describe('busyText', () => {
  it('one day, a range, and an open span', () => {
    expect(busyText(r, { fromDay: TODAY, toDay: TODAY }, 'en')).toBe('Busy Thu, Nov 12');
    expect(busyText(r, { fromDay: TODAY, toDay: TODAY + 3 }, 'en')).toBe(
      'Busy Thu, Nov 12 – Sun, Nov 15',
    );
    expect(busyText(r, { fromDay: TODAY, toDay: null }, 'en')).toBe('Busy from Thu, Nov 12');
  });
});
