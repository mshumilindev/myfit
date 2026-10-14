import { describe, expect, it } from 'vitest';
import { ALL_OFF } from '../../domain/consent';

const C = 'client-1';
const T = 'trainer-1';
const NOW = 1_800_000_000_000;

describe('schedule join (pure)', () => {
  it('fills planned per week and this week from the generated sessions', async () => {
    const { joinSchedule } = await import('./scheduleJoin');
    const { emptyDoc } = await import('../../schedule/types');
    const { weekStartOf, WEEK } = await import('../../domain/time');
    const { dayOfTs } = await import('../../schedule/time');
    const now = NOW;
    const thisWeekDay = dayOfTs(weekStartOf(now));
    const doc = {
      ...emptyDoc(C),
      patterns: [
        {
          id: 'p1',
          fromDay: thisWeekDay - 28,
          weeks: 8,
          rows: [
            { id: 'r1', dow: 0, start: '07:00', dur: 60, gymId: 'g' },
            { id: 'r2', dow: 3, start: '07:00', dur: 60, gymId: 'g' },
          ],
        },
      ],
    };
    const out = joinSchedule(
      {
        now,
        clients: [{ id: C, planned: 0, done: 0 } as never],
        inputs: [
          {
            clientId: C,
            mode: 'app',
            consent: ALL_OFF,
            totals: {
              completedWeeks: [1, 1, 1, 1].map((done) => ({ done, planned: 0 })),
              plannedThisWeek: 0,
              daysSinceLast: 2,
              sessionsLast4Weeks: 4,
            },
          },
        ],
      },
      { docs: [doc], requests: [], asOf: now },
    );
    expect(out.inputs[0].totals?.completedWeeks.map((w) => w.planned)).toEqual([2, 2, 2, 2]);
    expect(out.inputs[0].totals?.plannedThisWeek).toBe(2);
    expect(out.clients[0].planned).toBe(2);
    expect(out.slots.length).toBeGreaterThanOrEqual(2);
    expect(out.slots.every((s) => s.start >= weekStartOf(now) - WEEK)).toBe(true);
    expect(joinSchedule({ now, clients: [], inputs: [] }, null).slots).toEqual([]);
  });
});

describe('share source mapping (pure)', () => {
  it('maps a program and a person without inventing data', async () => {
    const { clientShareData, programToSource } = await import('./shareSource');
    const p = programToSource(
      {
        id: 'p1',
        name: 'Upper Lower',
        weeks: 8,
        daysPerWeek: 2,
        status: 'active',
        authorId: T,
        dayNames: { '1': 'Upper A' },
        targetMuscles: { '3': ['legs'] },
        items: [
          {
            id: 'i1',
            day: 1,
            position: 0,
            name: 'Bench Press',
            kind: 'strength',
            sets: 3,
            reps: 5,
            durationMin: null,
            equipment: [],
            targetWeight: 80,
          },
          {
            id: 'i2',
            day: 1,
            position: 1,
            name: 'Row',
            kind: 'strength',
            sets: 0,
            reps: 0,
            durationMin: null,
            equipment: [],
            bare: true,
          },
        ],
      } as never,
      [C],
    );
    expect(p.days[0]).toMatchObject({
      name: 'Upper A',
      wd: 'Mon',
      rows: [
        { name: 'Bench Press', sets: 3, reps: '5', kg: '80' },
        { name: 'Row', sets: 0 },
      ],
    });
    expect(p.assignedTo).toEqual([C]);
    const none = clientShareData({
      clientId: C,
      firstName: 'Oleh',
      mode: 'app',
      consent: { ...ALL_OFF, sets: 'effects' },
      now: NOW,
    });
    expect(none.workouts).toEqual([]);
    expect(none.activities).toEqual([]);
  });
});
