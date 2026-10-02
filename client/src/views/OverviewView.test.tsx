import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverviewView } from './OverviewView';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { setLocale } from '../i18n';
import type { Activity } from '../types';

vi.mock('../data/programMine', () => ({
  useProgramMine: () => ({ assignment: null, active: true }),
  programDayHasPlan: () => false,
  programDayName: () => '',
}));

const NOW = new Date(2026, 8, 30, 12).getTime();
const act = (
  type: string,
  category: Activity['category'],
  daysAgo: number,
  min: number,
): Activity => ({
  id: `${type}${daysAgo}`,
  type,
  category,
  startedAt: NOW - daysAgo * 86400000,
  finishedAt: NOW - daysAgo * 86400000 + min * 60000,
  durationMin: min,
});

const mount = (onActivity = vi.fn()) => {
  render(
    <OverviewView
      shell={{ openOverlay: vi.fn() } as never}
      onProgress={() => undefined}
      onTrends={() => undefined}
      onActivity={onActivity}
      onPrograms={() => undefined}
    />,
  );
  return onActivity;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Overview › Activities tile', () => {
  it('is absent until there are enough activities to trend', () => {
    __replaceStateForTests({
      ...__getStateForTests(),
      activities: [act('run', 'conditioning', 3, 30)],
    });
    mount();
    expect(screen.queryByText('Activities')).toBeNull();
  });

  it("shows this week's active time and opens the Activity page", () => {
    __replaceStateForTests({
      ...__getStateForTests(),
      activities: [
        act('run', 'conditioning', 1, 30),
        act('massage', 'recovery', 2, 60),
        act('dance', 'conditioning', 12, 45),
      ],
    });
    const onActivity = mount();
    expect(screen.getByText('1h 30m this week')).toBeTruthy();
    fireEvent.click(screen.getByText('Activities'));
    expect(onActivity).toHaveBeenCalledTimes(1);
  });
});
