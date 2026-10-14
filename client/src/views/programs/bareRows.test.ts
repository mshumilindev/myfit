import { describe, expect, it } from 'vitest';
import { compactProgramDaySummary, effectiveSets, isBare, toSaved, freshProgram } from './model';

const row = (o: Record<string, unknown>) =>
  ({ kind: 'strength', sets: 3, reps: 8, durationMin: null, ...o }) as Parameters<
    typeof compactProgramDaySummary
  >[0][number];

describe('bare rows in the program model (R-KIT-08)', () => {
  it('a bare row asks for no sets, by flag or by zero sets', () => {
    expect(isBare(row({ bare: true }))).toBe(true);
    expect(isBare(row({ sets: 0, reps: 0 }))).toBe(true);
    expect(isBare(row({}))).toBe(false);
    expect(effectiveSets(row({ bare: true }))).toBe(0);
    expect(effectiveSets(row({}))).toBe(3);
  });

  it('the day summary never prints "0 x 0"', () => {
    expect(compactProgramDaySummary([row({ sets: 0, reps: 0 })])).toBe('');
    expect(compactProgramDaySummary([row({ bare: true }), row({ bare: true })])).toBe('');
    expect(compactProgramDaySummary([row({}), row({ bare: true })])).toBe('3');
    expect(compactProgramDaySummary([row({})])).toBe('3 × 8');
  });

  it('a program saves with the bare flag and the trainer targets intact', () => {
    const p = freshProgram('X');
    const saved = toSaved(
      {
        ...p,
        items: [
          {
            id: 'a',
            day: 1,
            position: 0,
            name: 'Plank',
            kind: 'strength',
            sets: 0,
            reps: 0,
            durationMin: null,
            equipment: [],
            bare: true,
          },
        ],
      },
      'u1',
      'X',
    );
    expect(JSON.stringify(saved)).toContain('"bare":true');
  });
});
