import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlanDoc } from './types';
import { draftToPlan, newDraft } from './draft';
import { zonedToUtc } from './zoned';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const state = vi.hoisted(() => ({ plans: [] as PlanDoc[] }));
vi.mock('./sync', () => ({ usePlans: () => state.plans }));

import { UpNext, whenText } from './UpNext';
import { STRINGS } from './strings';

const DAY = '2026-11-12';
const now = zonedToUtc(DAY, '10:00', TZ);
const mk = (id: string, time: string, over: Record<string, unknown> = {}) => {
  const [h, m] = time.split(':').map(Number);
  return draftToPlan(
    { ...newDraft(id, DAY), title: id, hour: h, minute: m, ...over },
    TZ,
    undefined,
  );
};
afterEach(cleanup);

describe('UpNext widget', () => {
  it.each(['S', 'M', 'L', 'XL'] as const)('shows the next plan at size %s', (size) => {
    state.plans = [mk('Run', '12:30'), mk('Stretch', '19:00')];
    render(<UpNext size={size} now={now} onOpen={() => {}} />);
    expect(screen.getAllByText(/Run/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/In 2 h 30/).length).toBeGreaterThan(0);
  });
  it('lists the plans after the first at L and XL', () => {
    state.plans = [mk('Run', '12:30'), mk('Stretch', '19:00')];
    render(<UpNext size="L" now={now} onOpen={() => {}} />);
    expect(screen.getByText('Stretch')).toBeTruthy();
    expect(screen.getByText('19:00')).toBeTruthy();
  });
  it('says a persistent reminder rings until dismissed (L)', () => {
    state.plans = [mk('Run', '12:30', { mode: 'ring' })];
    render(<UpNext size="L" now={now} onOpen={() => {}} />);
    expect(screen.getByText(/Rings until you dismiss it/)).toBeTruthy();
  });
  it('shows "Now" while a plan is running', () => {
    state.plans = [mk('Run', '09:30')];
    render(<UpNext size="L" now={now} onOpen={() => {}} />);
    expect(screen.getAllByText('Now').length).toBeGreaterThan(0);
  });
  it('has an empty state that opens the Planner', () => {
    state.plans = [];
    const open = vi.fn();
    render(<UpNext size="L" now={now} onOpen={open} />);
    expect(screen.getByText('Nothing planned')).toBeTruthy();
    fireEvent.click(screen.getByText('Add a plan'));
    expect(open).toHaveBeenCalled();
  });
  it('opens the Planner from the card', () => {
    state.plans = [mk('Run', '12:30')];
    const open = vi.fn();
    render(<UpNext size="M" now={now} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Run/ }));
    expect(open).toHaveBeenCalled();
  });
});

describe('whenText', () => {
  it('names the weekday once it is a day or more away', () => {
    const p = mk('Run', '10:00');
    const item = {
      plan: p,
      day: DAY,
      startAt: now + 30 * 3_600_000,
      endAt: now + 31 * 3_600_000,
      ongoing: false,
    };
    expect(whenText(STRINGS.en, 'en', item, now)).not.toMatch(/^In /);
  });
});
