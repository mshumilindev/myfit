import { describe, it, expect } from 'vitest';
import { weekOrder, weekPos, weekStartOf, dateInWeek, isoWeekday } from '../client/src/weekStart';
describe('training week start (Profile › Settings)', () => {
  it('orders and bounds', () => {
    expect(weekOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(weekOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekPos(1, 7)).toBe(1);
    const sat = new Date(2026, 8, 26, 15).getTime(); // Saturday
    expect(isoWeekday(sat)).toBe(6);
    expect(new Date(weekStartOf(sat, 7)).getDate()).toBe(20); // Sunday 20th
    expect(new Date(weekStartOf(sat, 1)).getDate()).toBe(21); // Monday 21st
    expect(new Date(weekStartOf(sat, 6)).getDate()).toBe(26); // Saturday itself
    const ws = weekStartOf(sat, 7);
    expect(new Date(dateInWeek(ws, 6, 7)).getDate()).toBe(26);
    expect(new Date(dateInWeek(ws, 7, 7)).getDate()).toBe(20);
  });
});
