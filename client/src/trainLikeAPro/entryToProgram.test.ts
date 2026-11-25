import { describe, expect, it } from 'vitest';
import { entryToProgram, programIdFor, programNameFor } from './entryToProgram';
import { CATALOG } from './catalog';
import { sanitizeActivities } from '../views/programs/model';

describe('entryToProgram', () => {
  it('builds the same program for the same entry (idempotent ids)', () => {
    for (const e of CATALOG) {
      const a = entryToProgram(e, 'u1', 1);
      const b = entryToProgram(e, 'u1', 2);
      expect({ ...a, updatedAt: 0 }).toEqual({ ...b, updatedAt: 0 });
      expect(a.id).toBe(programIdFor('u1', e.id));
    }
  });

  it('keeps every row and every field: nothing of the entry is lost', () => {
    for (const e of CATALOG) {
      const p = entryToProgram(e, 'u1', 1);
      expect(p.items).toHaveLength(e.items.length);
      expect(p.name).toBe(programNameFor(e));
      expect(p.weeks).toBe(e.weeks);
      expect(p.daysPerWeek).toBe(e.daysPerWeek);
      expect(p.dayNames).toEqual(e.dayNames);
      expect(p.status).toBe('active');
      expect(p.authorId).toBe('u1');
      p.items.forEach((it, i) => {
        const row = e.items[i];
        expect(it).toMatchObject({
          day: row.day,
          position: row.position,
          name: row.name,
          sets: row.sets,
          reps: row.reps,
          equipment: row.equipment,
        });
        expect(it.restSec).toBe(row.restSec);
        expect(it.targetRpe).toBe(row.targetRpe);
        expect(it.note).toBe(row.note);
        expect(it.groupId).toBe(row.groupId);
        expect(it.groupOrder).toBe(row.groupOrder);
        expect(Boolean(it.bare)).toBe(Boolean(row.bare));
        expect(it.durationMin).toBeNull();
      });
      expect(new Set(p.items.map((i) => i.id)).size).toBe(p.items.length);
    }
  });

  it('activities survive the program sanitiser unchanged', () => {
    for (const e of CATALOG.filter((x) => x.activities.length)) {
      const p = entryToProgram(e, 'u1', 1);
      expect(sanitizeActivities(p.activities)).toEqual(p.activities);
      expect(p.activities).toHaveLength(e.activities.length);
    }
  });

  it('puts the athlete first in the name', () => {
    const e = CATALOG.find((x) => x.id === 'linear-5x5-ab')!;
    expect(entryToProgram(e, 'u', 1).name.startsWith(e.who)).toBe(true);
  });
});
