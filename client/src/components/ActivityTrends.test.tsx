import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Activity } from '../types';
import { ActivityTrends } from './ActivityTrends';
import { setLocale } from '../i18n';

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 8, 30, 12, 0).getTime();

function act(
  type: string,
  daysAgo: number,
  min: number,
  category: Activity['category'] = 'conditioning',
): Activity {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id: `${type}-${daysAgo}`,
    type,
    category,
    startedAt,
    finishedAt: startedAt + min * 60000,
    durationMin: min,
  } as Activity;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ActivityTrends', () => {
  it('renders nothing for fewer than two finished sessions', () => {
    const { container } = render(<ActivityTrends activities={[act('padel', 1, 60)]} bodyKg={80} />);
    expect(container.querySelector('.atr')).toBeNull();
  });

  it('shows totals and the most frequent types, and opens a type sheet', () => {
    const acts = [
      act('padel', 4, 80),
      act('padel', 11, 75),
      act('padel', 18, 90),
      act('walk', 1, 30),
      act('yoga', 2, 30, 'recovery'),
    ];
    const onAdd = vi.fn();
    render(<ActivityTrends activities={acts} bodyKg={80} onAddToProgram={onAdd} />);
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('Padel')).toBeTruthy();
    fireEvent.click(screen.getByText('Padel'));
    expect(screen.getByText('Median')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add to program/ }));
    expect(onAdd).toHaveBeenCalledWith('padel');
  });
});
