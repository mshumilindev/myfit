import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { setCoachTimeZone } from '../format';
import type { ClientAvailability } from '../domain/availability';
import { weekdayOfKey } from '../domain/availability';
import { setViewport } from '../testViewport';
import { TODAY_KEY } from './__fixtures__/fixtures';
import type { People } from './people';
import { dayOfTs, tsOf } from './time';
import { WeekGrid } from './WeekGrid';

const none = { name: () => '', byId: new Map() } as unknown as People;

beforeEach(() => {
  setViewport(1440);
  setCoachTimeZone('UTC');
});
afterEach(cleanup);

const grid = (days: number[], free: ClientAvailability | null | undefined) =>
  render(
    <WeekGrid
      days={days}
      slots={[]}
      ghosts={[]}
      conflicts={new Set()}
      now={tsOf(TODAY_KEY, 9 * 60)}
      today={dayOfTs(tsOf(TODAY_KEY, 9 * 60))}
      selected={null}
      onSelect={() => undefined}
      people={none}
      t={t}
      locale="en"
      free={free}
    />,
  );
const bands = (c: HTMLElement) => c.querySelectorAll('.sc-freeband');

describe('Schedule week grid: one client free hours (SPO-552)', () => {
  it('shades the free hours in the columns of the days they apply to, under the sessions, and says nothing to a screen reader', () => {
    const wd = weekdayOfKey(TODAY_KEY);
    const { container } = grid([TODAY_KEY, TODAY_KEY + 1], {
      weekly: {
        [wd]: [
          [480, 600],
          [1080, 1200],
        ],
      },
      unavailable: [],
    });
    expect(bands(container)).toHaveLength(2);
    bands(container).forEach((b) => expect(b.getAttribute('aria-hidden')).toBe('true'));
    expect(container.querySelectorAll('.sc-col')[0].querySelectorAll('.sc-freeband')).toHaveLength(
      2,
    );
    expect(container.querySelectorAll('.sc-col')[1].querySelectorAll('.sc-freeband')).toHaveLength(
      0,
    );
  });

  it('nothing when no availability is given (not shared, not asked for, still loading)', () => {
    expect(bands(grid([TODAY_KEY], null).container)).toHaveLength(0);
    cleanup();
    expect(bands(grid([TODAY_KEY], undefined).container)).toHaveLength(0);
  });

  it('a not-available day is not shaded at all', () => {
    const wd = weekdayOfKey(TODAY_KEY);
    const { container } = grid([TODAY_KEY], {
      weekly: { [wd]: [[480, 600]] },
      unavailable: [{ fromDay: TODAY_KEY, toDay: TODAY_KEY }],
    });
    expect(bands(container)).toHaveLength(0);
  });

  it('a band keeps its place inside the visible hours (top and height are fractions of the column)', () => {
    const wd = weekdayOfKey(TODAY_KEY);
    const { container } = grid([TODAY_KEY], { weekly: { [wd]: [[480, 600]] }, unavailable: [] });
    const b = container.querySelector<HTMLElement>('.sc-freeband')!;
    const top = Number(b.style.getPropertyValue('--sc-top'));
    const h = Number(b.style.getPropertyValue('--sc-h'));
    expect(top).toBeGreaterThanOrEqual(0);
    expect(h).toBeGreaterThan(0);
    expect(top + h).toBeLessThanOrEqual(1);
  });
});
