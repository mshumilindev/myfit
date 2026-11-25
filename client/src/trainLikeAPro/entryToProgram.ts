/**
 * Train like a pro: catalog entry → the program that "Start" creates. Pure and deterministic, so starting
 * the same entry twice builds the same ids (idempotent upsert, invariant 3) and nothing of the entry is lost.
 */
import type { Program, ProgramActivity } from '../views/programs/model';
import type { ProgramItem } from '../views/programs/modelTypes';
import type { CatalogEntry } from './catalog/types';

/** The id of the program a member gets from an entry. Must equal the server's rule (`tl-<uid>-<entryId>`). */
export const programIdFor = (uid: string, entryId: string): string => `tl-${uid}-${entryId}`;

/** The program name: whose it is first, then what it is. */
export const programNameFor = (entry: Pick<CatalogEntry, 'who' | 'title'>): string =>
  `${entry.who}: ${entry.title}`;

export function entryToProgram(entry: CatalogEntry, uid: string, now: number): Program {
  const id = programIdFor(uid, entry.id);
  const items: ProgramItem[] = entry.items.map((row) => ({
    id: `${id}-${row.day}-${row.position}`,
    day: row.day,
    position: row.position,
    name: row.name,
    kind: row.kind,
    sets: row.sets,
    reps: row.reps,
    durationMin: null,
    equipment: [...row.equipment],
    ...(row.groupId ? { groupId: row.groupId } : {}),
    ...(row.groupOrder !== undefined ? { groupOrder: row.groupOrder } : {}),
    ...(row.bare ? { bare: true } : {}),
    ...(row.restSec !== undefined ? { restSec: row.restSec } : {}),
    ...(row.targetRpe !== undefined ? { targetRpe: row.targetRpe } : {}),
    ...(row.note ? { note: row.note } : {}),
  }));
  const activities: ProgramActivity[] = entry.activities.map((a, i) => ({
    id: `${id}-a${i}`,
    day: a.day,
    type: a.type,
    minutes: a.minutes,
    effort: a.effort,
    when: a.when,
  }));
  return {
    id,
    name: programNameFor(entry),
    weeks: entry.weeks,
    daysPerWeek: entry.daysPerWeek,
    status: 'active',
    authorId: uid,
    dayNames: { ...entry.dayNames },
    targetMuscles: {},
    items,
    ...(activities.length ? { activities } : {}),
    updatedAt: now,
  };
}
