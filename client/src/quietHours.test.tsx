import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeEn as sf } from './i18n/coachSafe.en';
import {
  DEFAULT_QUIET,
  isQuietAt,
  loadQuiet,
  parseQuiet,
  resetQuietForTests,
  type QuietHours,
} from './quietHours';
import { QuietHoursRows } from './views/QuietHoursRows';

vi.mock('./push', () => ({ syncQuietToServer: vi.fn(async () => undefined) }));

const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m);

beforeEach(() => {
  localStorage.clear();
  resetQuietForTests();
});
afterEach(cleanup);

describe('quiet hours', () => {
  it('defaults to on, 22:00 to 07:00, and wraps midnight', () => {
    expect(DEFAULT_QUIET).toEqual({ on: true, from: 1320, to: 420 });
    expect(isQuietAt(DEFAULT_QUIET, at(22))).toBe(true);
    expect(isQuietAt(DEFAULT_QUIET, at(23, 59))).toBe(true);
    expect(isQuietAt(DEFAULT_QUIET, at(3))).toBe(true);
    expect(isQuietAt(DEFAULT_QUIET, at(6, 59))).toBe(true);
    expect(isQuietAt(DEFAULT_QUIET, at(7))).toBe(false);
    expect(isQuietAt(DEFAULT_QUIET, at(12))).toBe(false);
    expect(isQuietAt(DEFAULT_QUIET, at(21, 59))).toBe(false);
  });
  it('a same-day window, off, and from == to', () => {
    const day: QuietHours = { on: true, from: 13 * 60, to: 15 * 60 };
    expect(isQuietAt(day, at(14))).toBe(true);
    expect(isQuietAt(day, at(15))).toBe(false);
    expect(isQuietAt({ ...day, on: false }, at(14))).toBe(false);
    expect(isQuietAt({ on: true, from: 600, to: 600 }, at(10))).toBe(false);
  });
  it('untrusted stored values are clamped to a safe shape', () => {
    expect(parseQuiet({ on: 'yes', from: 99999, to: -4 })).toEqual({ on: true, from: 1439, to: 0 });
    expect(parseQuiet(null)).toEqual(DEFAULT_QUIET);
  });
  it('the Profile rows toggle it, change the times, persist, and tell the server', async () => {
    const { syncQuietToServer } = await import('./push');
    render(<QuietHoursRows />);
    expect(screen.getByText(sf.qhSub('22:00', '07:00'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(sf.qhFrom), { target: { value: String(23 * 60) } });
    expect(screen.getByText(sf.qhSub('23:00', '07:00'))).toBeTruthy();
    expect(loadQuiet().from).toBe(1380);
    expect(JSON.parse(localStorage.getItem('spotter.quietHours') as string).from).toBe(1380);
    await act(async () => undefined);
    expect(syncQuietToServer).toHaveBeenCalledWith(expect.objectContaining({ from: 1380 }));
    fireEvent.click(screen.getByRole('switch', { name: sf.qhTitle }));
    expect(screen.queryByLabelText(sf.qhFrom)).toBeNull();
    expect(loadQuiet().on).toBe(false);
  });
});
