import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  detectColumns,
  splitSetsReps,
  buildRows,
  summarize,
  rowsToItems,
  programToCsv,
  templateCsv,
  nearest,
} from '../client/src/data/programCsv';

describe('programCsv', () => {
  it('parses quoted cells, commas and CRLF', () => {
    const grid = parseCsv('a,b\r\n"x,y",z\n1,2');
    expect(grid).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
      ['1', '2'],
    ]);
  });

  it('splits sets x reps in several notations', () => {
    expect(splitSetsReps('3x8')).toEqual({ sets: 3, reps: 8 });
    expect(splitSetsReps('4 × 10')).toEqual({ sets: 4, reps: 10 });
    expect(splitSetsReps('5*5')).toEqual({ sets: 5, reps: 5 });
    expect(splitSetsReps('nope')).toEqual({});
  });

  it('discards a weight column and never emits load', () => {
    const csv = 'Day,Exercise,Sets,Reps,Weight\n1,Squat,5,5,100';
    const grid = parseCsv(csv);
    const cols = detectColumns(grid[0]);
    expect(cols.find((c) => c.header === 'Weight')?.field).toBe('weight');
    const rows = buildRows(grid, cols, ['Squat']);
    const shape = summarize(rows, cols);
    expect(shape.discardedWeight).toBe(true);
    // No field on the row carries the weight value.
    expect(JSON.stringify(rows[0])).not.toContain('100');
  });

  it('flags missing reps, bad day and unknown equipment but still imports', () => {
    const csv = 'Day,Exercise,Sets,Reps,Equipment\n9,Bench,3,,barbell\n1,Curl,3,10,unicorn';
    const grid = parseCsv(csv);
    const cols = detectColumns(grid[0]);
    const rows = buildRows(grid, cols, ['Bench', 'Curl']);
    expect(rows[0].problems).toContain('missing-reps');
    expect(rows[0].problems).toContain('bad-day');
    expect(rows[0].day).toBeGreaterThanOrEqual(1);
    expect(rows[0].day).toBeLessThanOrEqual(7);
    expect(rows[1].problems).toContain('unknown-equipment');
    expect(rows[1].unknownEquipment).toEqual(['unicorn']);
    // Both still produce items (AC-CSV-07).
    expect(rowsToItems(rows)).toHaveLength(2);
  });

  it('suggests a nearest known exercise for a misspelling', () => {
    expect(nearest('Bech Press', ['Bench Press', 'Squat'])).toBe('Bench Press');
    const csv = 'Day,Exercise,Sets,Reps\n1,Bech Press,3,8';
    const rows = buildRows(parseCsv(csv), detectColumns(['Day', 'Exercise', 'Sets', 'Reps']), [
      'Bench Press',
    ]);
    expect(rows[0].problems).toContain('unmatched-exercise');
    expect(rows[0].suggestion).toBe('Bench Press');
  });

  it('assigns per-day positions in order', () => {
    const csv = 'Day,Exercise,Sets,Reps\n1,A,3,8\n1,B,3,8\n2,C,3,8';
    const rows = buildRows(parseCsv(csv), detectColumns(['Day', 'Exercise', 'Sets', 'Reps']), []);
    const items = rowsToItems(rows);
    expect(items.map((i) => [i.day, i.position])).toEqual([
      [1, 0],
      [1, 1],
      [2, 0],
    ]);
  });

  it('round-trips export → import to identical items', () => {
    const items = [
      {
        day: 1,
        position: 0,
        name: 'Back Squat',
        kind: 'strength' as const,
        sets: 5,
        reps: 5,
        durationMin: null,
        equipment: ['barbell' as const],
      },
      {
        day: 1,
        position: 1,
        name: 'Row, wide',
        kind: 'strength' as const,
        sets: 3,
        reps: 8,
        durationMin: null,
        equipment: ['barbell' as const, 'cable' as const],
      },
      {
        day: 3,
        position: 0,
        name: 'Easy Run',
        kind: 'cardio' as const,
        sets: 3,
        reps: 0,
        durationMin: 25,
        equipment: [],
      },
    ];
    const csv = programToCsv(items);
    const back = rowsToItems(buildRows(parseCsv(csv), detectColumns(parseCsv(csv)[0]), []));
    expect(back).toEqual(
      items.map((i) => ({
        day: i.day,
        position: i.position,
        name: i.name,
        kind: i.kind,
        sets: i.kind === 'strength' ? i.sets : 3,
        reps: i.kind === 'strength' ? i.reps : 0,
        durationMin: i.durationMin,
        equipment: i.equipment,
      })),
    );
    expect(csv).not.toMatch(/weight/i);
  });

  it('template is well-formed and self-describing', () => {
    const grid = parseCsv(templateCsv());
    expect(grid[0]).toEqual(['Day', 'Exercise', 'Kind', 'Sets', 'Reps', 'Duration', 'Equipment']);
    expect(grid.length).toBeGreaterThan(1);
  });
});
