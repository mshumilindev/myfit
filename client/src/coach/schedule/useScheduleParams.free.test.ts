import { describe, expect, it } from 'vitest';
import { readScheduleParams, scheduleHref, writeScheduleParams } from './useScheduleParams';

describe('schedule params: free hours of the filtered client', () => {
  it('free=1 is read, anything else is off', () => {
    expect(readScheduleParams('#/c/schedule?who=c1&free=1').free).toBe('1');
    expect(readScheduleParams('#/c/schedule?who=c1&free=0').free).toBeNull();
    expect(readScheduleParams('#/c/schedule?who=c1&free=yes').free).toBeNull();
    expect(readScheduleParams('#/c/schedule').free).toBeNull();
  });
  it('is written back with the filter, and omitted when off', () => {
    expect(scheduleHref({ who: 'c1', free: '1' })).toBe('#/c/schedule?who=c1&free=1');
    expect(scheduleHref({ who: 'c1', free: null })).toBe('#/c/schedule?who=c1');
    expect(
      writeScheduleParams('#/c/schedule', readScheduleParams('#/c/schedule?who=c1&free=1')),
    ).toBe('#/c/schedule?who=c1&free=1');
  });
  it('the one-off form for a client carries the filter and the shading together', () => {
    const p = readScheduleParams(
      scheduleHref({ form: 'oneoff', client: 'c1', who: 'c1', free: '1' }),
    );
    expect(p).toMatchObject({ form: 'oneoff', client: 'c1', who: 'c1', free: '1' });
  });
});
