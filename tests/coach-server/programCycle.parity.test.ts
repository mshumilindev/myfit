/** The server counts planned days exactly like the client does (SPO-609): same program, same number, every week. */
import { describe, expect, it } from 'vitest';
import { plannedThrough as serverThrough } from '../../functions/src/programCycle';
import { plannedThrough as clientThrough } from '../../client/src/periodization/cycle';
import type { WeekSource } from '../../client/src/periodizationApi';

const row = (day: number) => ({ day, name: 'Squat' });
const programs: Array<Record<string, unknown>> = [
  { items: [row(1), row(3)], dayNames: {}, targetMuscles: {} },
  {
    items: [row(1), row(3), row(5)],
    dayNames: { '6': 'Arms' },
    targetMuscles: { '2': ['chest'] },
    cycle: {
      length: 4,
      weeks: [
        { items: [row(1)], dayNames: {}, targetMuscles: {} },
        { items: [], dayNames: { '2': 'Rest test' }, targetMuscles: {} },
      ],
    },
  },
  { items: [row(2)], dayNames: {}, targetMuscles: {}, cycle: { length: 15, weeks: [] } },
  { items: [row(2)], dayNames: {}, targetMuscles: {}, cycle: { length: 2.5, weeks: [] } },
];

describe('server and client plan the same days', () => {
  it.each(programs.map((p, i) => [i, p] as const))('program %i', (_i, p) => {
    const days = new Set<number>();
    for (const it of p.items as Array<{ day: number }>) days.add(it.day);
    const server = { ...p, daysPerWeek: days.size };
    for (const week of [0, 1, 2, 3, 4, 5, 8, 13, 26])
      expect(serverThrough(server as never, week), `week ${week}`).toBe(
        clientThrough(p as unknown as WeekSource, week),
      );
  });
});
