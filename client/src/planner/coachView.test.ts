import { describe, expect, it } from 'vitest';
import { buildCoachAvailability } from './coachView';
import type { Injury, RestPeriod } from '../types';

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

  const injury = (over: Partial<Injury>): Injury =>
    ({
      id: 'i',
      startDay: 19995,
      stage: 'protect',
      fullRestUntil: 20005,
      healedDay: null,
      ...over,
    }) as Injury;
  const share = { shareAvailability: true, availability: hours };

  it('an injury inside the clinician no-load window reads as plain "not available"', () => {
    const v = buildCoachAvailability(share, [], 19990, () => true, [injury({})]);
    expect(v?.unavailable).toEqual([{ fromDay: 19995, toDay: 20004 }]);
    expect(JSON.stringify(v)).not.toMatch(/injur|protect|stage/i);
  });

  it('no window, a finished window, or a healed injury adds nothing', () => {
    const none = [
      injury({ fullRestUntil: null }),
      injury({ fullRestUntil: 19990 }),
      injury({ healedDay: 19992 }),
    ];
    expect(buildCoachAvailability(share, [], 19990, () => true, none)?.unavailable).toEqual([]);
  });

  it('injuries are ignored when none are passed (Health module off), and merge in start order', () => {
    expect(buildCoachAvailability(share, [], 19990, () => true)?.unavailable).toEqual([]);
    const v = buildCoachAvailability(share, [period({})], 19990, () => true, [injury({})]);
    expect(v?.unavailable.map((u) => u.fromDay)).toEqual([19995, 20000]);
  });
});
