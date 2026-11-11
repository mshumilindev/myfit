import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useDesktopEngine } from './useDesktopEngine';
import type { PlanDoc } from './types';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const plan = {
  id: 'p1',
  title: 'Mobility',
  icon: 'bell',
  color: 'accent',
  timing: { kind: 'once', day: '2026-11-11', time: '18:30', tz: 'UTC', lead: 0 },
  mode: 'ring',
  enabled: true,
  nextFireAt: NOW + 60_000,
  fireAts: [NOW + 60_000],
  v: 1,
  updatedAt: 0,
} as unknown as PlanDoc;
const none = new Set<string>();

function Probe({ plans, wake }: { plans: PlanDoc[]; wake: () => void }) {
  useDesktopEngine(plans, NOW, none, {}, 'en', wake);
  return null;
}
type Due = (a: { id: string; at: number; mode: 'quiet' | 'ring' }) => void;
let due: Due = () => undefined;
const native = {
  scheduleAlarms: vi.fn(() => Promise.resolve()),
  setTray: vi.fn(() => Promise.resolve()),
  showAlarm: vi.fn(() => Promise.resolve()),
  onAlarmDue: vi.fn((cb: Due) => {
    due = cb;
    return () => undefined;
  }),
};

beforeEach(() => {
  Object.values(native).forEach((f) => f.mockClear());
  (window as unknown as { spotterNative?: unknown }).spotterNative = native;
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { spotterNative?: unknown }).spotterNative;
});

describe('useDesktopEngine', () => {
  it('hands the shell the moments and the tray line', () => {
    render(<Probe plans={[plan]} wake={() => undefined} />);
    expect(native.scheduleAlarms).toHaveBeenCalledWith([
      { id: `p1:${NOW + 60_000}`, at: NOW + 60_000, mode: 'ring' },
    ]);
    expect(native.setTray).toHaveBeenCalledWith({ next: { label: 'Mobility · 12:01' } });
  });

  it('on a due alarm wakes the layer and shows a notification when the window is not watched', () => {
    const wake = vi.fn();
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    render(<Probe plans={[plan]} wake={wake} />);
    due({ id: `p1:${NOW + 60_000}`, at: NOW + 60_000, mode: 'ring' });
    expect(wake).toHaveBeenCalled();
    expect(native.showAlarm).toHaveBeenCalledWith(
      expect.objectContaining({ id: `p1:${NOW + 60_000}`, title: 'Mobility', mode: 'ring' }),
    );
  });

  it('a ring on a focused visible window uses its own screen, no notification', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    render(<Probe plans={[plan]} wake={() => undefined} />);
    due({ id: `p1:${NOW + 60_000}`, at: NOW + 60_000, mode: 'ring' });
    expect(native.showAlarm).not.toHaveBeenCalled();
  });

  it('clears the shell when the Planner goes away', () => {
    const { unmount } = render(<Probe plans={[plan]} wake={() => undefined} />);
    native.scheduleAlarms.mockClear();
    native.setTray.mockClear();
    unmount();
    expect(native.scheduleAlarms).toHaveBeenCalledWith([]);
    expect(native.setTray).toHaveBeenCalledWith({ next: null });
  });

  it('does nothing outside the shell', () => {
    delete (window as unknown as { spotterNative?: unknown }).spotterNative;
    render(<Probe plans={[plan]} wake={() => undefined} />);
    expect(native.scheduleAlarms).not.toHaveBeenCalled();
  });
});
