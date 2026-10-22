import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../types';
import { HoldWatchSet, fmtHoldClock } from './HoldWatchSet';

const T0 = new Date(2026, 9, 14, 18, 0, 0).getTime();
const plank: Exercise = { id: 'pl', name: 'Plank', kind: 'strength', position: 0, sets: [] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(last: { values: number[]; hold: boolean } | null = null) {
  const onLog = vi.fn();
  const onSettings = vi.fn();
  render(<HoldWatchSet ex={plank} setNo={2} last={last} onLog={onLog} onSettings={onSettings} />);
  return { onLog, onSettings };
}

describe('fmtHoldClock', () => {
  it.each([
    [0, '0:00'],
    [9.9, '0:09'],
    [75, '1:15'],
    [600, '10:00'],
    [-5, '0:00'],
  ])('formats %s s as %s', (sec, out) => expect(fmtHoldClock(sec)).toBe(out));
});

describe('HoldWatchSet', () => {
  it('idles at 0:00 and offers settings, with the last hold when it was a hold', () => {
    const { onSettings } = mount({ values: [30, 45], hold: true });
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(document.querySelector('.hold-last')!.textContent).toContain('30 s · 45 s');
    fireEvent.click(screen.getByRole('button', { name: 'Set options' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('omits the last-time line when the previous log was not a hold or is empty', () => {
    mount({ values: [10], hold: false });
    expect(document.querySelector('.hold-last')).toBeNull();
    cleanup();
    mount({ values: [], hold: true });
    expect(document.querySelector('.hold-last')).toBeNull();
  });

  it('runs a stopwatch, persists the start, and logs the whole seconds on release', () => {
    const { onLog } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Start hold/ }));
    expect(localStorage.getItem('spotter.hold.pl')).toBe(String(T0));
    // released straight away is disabled (< 1 s)
    expect((screen.getByRole('button', { name: /Release/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    act(() => {
      vi.advanceTimersByTime(75_400);
    });
    expect(screen.getByText('1:15')).toBeTruthy();
    expect(document.querySelector('.hold-last')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Release/ }));
    expect(onLog).toHaveBeenCalledWith(75);
    expect(localStorage.getItem('spotter.hold.pl')).toBeNull();
    expect(screen.getByText('0:00')).toBeTruthy();
  });

  it('logs at least one second even for an instant release', () => {
    const { onLog } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Start hold/ }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole('button', { name: /Release/ }));
    expect(onLog).toHaveBeenCalledWith(1);
  });

  it('cancel drops the running hold without logging', () => {
    const { onLog } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Start hold/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel this hold' }));
    expect(onLog).not.toHaveBeenCalled();
    expect(localStorage.getItem('spotter.hold.pl')).toBeNull();
    expect(screen.getByRole('button', { name: /Start hold/ })).toBeTruthy();
  });

  it('resumes a hold that was running when the screen was left', () => {
    localStorage.setItem('spotter.hold.pl', String(T0 - 20_000));
    mount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('0:20')).toBeTruthy();
  });

  it('ignores a junk stored start', () => {
    localStorage.setItem('spotter.hold.pl', 'abc');
    mount();
    expect(screen.getByRole('button', { name: /Start hold/ })).toBeTruthy();
  });

  it('still works when storage throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { onLog } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Start hold/ }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole('button', { name: /Release/ }));
    expect(onLog).toHaveBeenCalledWith(3);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
