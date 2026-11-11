import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlanDoc } from './types';

const plans = vi.hoisted(() => ({ v: [] as PlanDoc[] }));
vi.mock('./sync', () => ({ usePlans: () => plans.v }));
const shared = vi.hoisted(() => ({
  v: { handled: new Set<string>(), snoozed: {} as Record<string, number> },
  writes: [] as unknown[],
}));
vi.mock('./alertsSync', () => ({
  useSharedAlerts: () => shared.v,
  writeAlert: (...a: unknown[]) => {
    shared.writes.push(a);
    return Promise.resolve();
  },
}));
import { RingLayer } from './RingLayer';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const plan = (over: Partial<PlanDoc> = {}): PlanDoc =>
  ({
    id: 'p1',
    title: 'Mobility',
    icon: 'bell',
    color: 'accent',
    timing: { kind: 'once', day: '2026-11-11', time: '12:00', tz: 'UTC', lead: 0 },
    mode: 'ring',
    respectQuiet: false,
    enabled: true,
    nextFireAt: NOW,
    fireAts: [NOW],
    v: 1,
    updatedAt: 0,
    ...over,
  }) as unknown as PlanDoc;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW + 1000);
  localStorage.clear();
  plans.v = [plan()];
  shared.v = { handled: new Set(), snoozed: {} };
  shared.writes = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RingLayer', () => {
  it('takes the screen for a ring-mode plan whose moment has come', () => {
    render(<RingLayer />);
    expect(screen.getByRole('alertdialog', { name: 'Mobility' })).toBeTruthy();
  });

  it('stays out of the way for a quiet plan, a disabled one and a moment that has not come', () => {
    plans.v = [plan({ mode: 'quiet' }), plan({ id: 'p2', enabled: false })];
    const { container } = render(<RingLayer />);
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
    expect(container.textContent).toBe('');
    cleanup();
    plans.v = [plan({ fireAts: [NOW + 3_600_000], nextFireAt: NOW + 3_600_000 })];
    render(<RingLayer />);
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
  });

  it('dismiss closes it for good and remembers it across a reload', () => {
    const { unmount } = render(<RingLayer />);
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
    expect(localStorage.getItem('planner.ring.v1')).toContain('p1');
    unmount();
    render(<RingLayer />);
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
  });

  it('snooze hides it until the chosen time, then it rings again', () => {
    render(<RingLayer />);
    fireEvent.click(screen.getByRole('button', { name: /Snooze/ }));
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(11 * 60_000);
    });
    // the ring window (10 min from the moment) is over by then, so a snooze never outlives it
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
  });

  it('writes the dismiss / snooze for the other devices', () => {
    render(<RingLayer />);
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(shared.writes).toHaveLength(1);
    expect((shared.writes[0] as unknown[])[3]).toEqual({ state: 'dismissed' });
  });

  it('stops ringing when another device dismissed it', () => {
    shared.v = { handled: new Set([`p1:${NOW}`]), snoozed: {} };
    render(<RingLayer />);
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
  });

  it('stays quiet while another device has it snoozed', () => {
    shared.v = { handled: new Set(), snoozed: { [`p1:${NOW}`]: NOW + 5 * 60_000 } };
    render(<RingLayer />);
    expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
  });
});
