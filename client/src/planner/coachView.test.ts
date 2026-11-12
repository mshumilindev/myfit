import { describe, expect, it } from 'vitest';
import { buildCoachAvailability } from './coachView';
import type { RestPeriod } from '../types';

const period = (over: Partial<RestPeriod>): RestPeriod =>
  ({
    id: 'p',
    startDay: 20000,
    endDay: 20002,
    mode: 'illness',
    createdAt: 0,
    ...over,
  }) as RestPeriod;
const hours = { 0: [[540, 600]] as [number, number][] };

describe('buildCoachAvailability', () => {
  it('is nothing while the person does not share', () => {
    expect(
      buildCoachAvailability(
        { shareAvailability: false, availability: hours },
        [period({})],
        19990,
        () => true,
      ),
    ).toBeNull();
  });

  it('carries the weekly hours and the unavailable days, never a reason', () => {
    const v = buildCoachAvailability(
      { shareAvailability: true, availability: hours },
      [period({}), period({ id: 'r', mode: 'off', startDay: 20010, endDay: 20011 })],
      19990,
      () => true,
    );
    expect(v).toEqual({
      weekly: hours,
      unavailable: [
        { fromDay: 20000, toDay: 20002 },
        { fromDay: 20010, toDay: 20011 },
      ],
    });
    expect(JSON.stringify(v)).not.toMatch(/illness|off|unwell|rest/);
  });

  it('leaves out a state whose Health module is off', () => {
    const v = buildCoachAvailability(
      { shareAvailability: true, availability: {} },
      [period({})],
      19990,
      () => false,
    );
    expect(v?.unavailable).toEqual([]);
  });
});
