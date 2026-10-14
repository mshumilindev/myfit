/**
 * Fixture program bundles (M3), built in the REAL `Program` model with real catalog names. Oleh Bondar's v5 draft is the
 * design's example: shared with Yulia, two muscles low (so Send is gated), one superset, trainer days Tue / Fri.
 * Everything else is derived for any client from its roster row, so every client has an editable program.
 */
import type { WorldData } from '../../data/port';
import type { CoachClient, Dow } from '../../domain/types';
import { FIXTURE_NOW, buildFixtureWorld } from '../../data/__fixtures__/fixtures';
import { DAY } from '../../domain/time';
import {
  freshProgram,
  normalizeItems,
  type Program,
  type ProgramActivity,
  type ProgramItem,
} from '../../../views/programs/model';
import type { EquipmentId } from '../../../data/equipment';
import { ISO_OF_DOW, type LibraryEntry, type ProgramBundle } from '../types';
import { exerciseFacts } from '../catalog';

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

interface Row {
  name: string;
  sets: number;
  reps: number;
  kg?: number;
  rpe?: number;
  rest?: number;
  group?: string;
  bare?: boolean;
  note?: string;
}
const R = (name: string, sets: number, reps: number, kg?: number, rpe = 8, rest?: number): Row => ({
  name,
  sets,
  reps,
  kg,
  rpe,
  rest,
});

function dayItems(day: number, rows: Row[], warm = false): ProgramItem[] {
  const out: ProgramItem[] = [];
  if (warm)
    out.push({
      id: id('w'),
      day,
      position: 0,
      name: 'Warm-up',
      kind: 'warmup',
      sets: 0,
      reps: 0,
      durationMin: 8,
      equipment: [],
    });
  const groups = new Map<string, number>();
  for (const r of rows) {
    const eq = exerciseFacts(r.name).equipment;
    const gid = r.group ? `g-${day}-${r.group}` : null;
    const order = gid ? (groups.get(gid) ?? 0) : null;
    if (gid) groups.set(gid, (order ?? 0) + 1);
    out.push({
      id: id(`i${day}`),
      day,
      position: out.length,
      name: r.name,
      kind: 'strength',
      sets: r.bare ? 0 : r.sets,
      reps: r.bare ? 0 : r.reps,
      durationMin: null,
      equipment: (eq ? [eq] : []) as EquipmentId[],
      groupId: gid,
      groupOrder: order,
      ...(r.bare ? { bare: true } : {}),
      ...(!r.bare && r.kg ? { targetWeight: r.kg } : {}),
      ...(!r.bare && r.rpe ? { targetRpe: r.rpe } : {}),
      ...(!r.bare && r.rest ? { restSec: r.rest } : {}),
      ...(r.note ? { note: r.note } : {}),
    });
  }
  return out;
}

const act = (
  day: number,
  type: string,
  minutes: number,
  effort: ProgramActivity['effort'],
  when: ProgramActivity['when'],
): ProgramActivity => ({
  id: id('a'),
  day,
  type,
  minutes,
  effort,
  when,
});

function program(
  name: string,
  author: string,
  days: Record<number, [string, Row[], boolean?]>,
  acts: ProgramActivity[],
): Program {
  const p = freshProgram(name);
  p.id = `prog-${name.replace(/\W+/g, '-').toLowerCase()}`;
  p.authorId = author;
  p.status = 'active';
  p.weeks = 0;
  const items: ProgramItem[] = [];
  for (const [d, [label, rows, warm]] of Object.entries(days)) {
    p.dayNames[d] = label;
    items.push(...dayItems(Number(d), rows, warm));
  }
  p.items = normalizeItems(items);
  p.daysPerWeek = Object.keys(days).length;
  if (acts.length) p.activities = acts;
  return p;
}

/** Upper/Lower 4x, v5 draft (Oleh). Chest, Back and Shoulders sit inside their range, Calves and Triceps do not. */
export function olehDraft(author = 'trainer-iryna'): Program {
  return program(
    'Upper/Lower 4x',
    author,
    {
      2: [
        'Upper A',
        [
          R('Barbell Bench Press - Medium Grip', 3, 5, 80, 8, 150),
          { ...R('Paused bench press', 1, 5, 90, 8, 150), note: '2 s pause on the chest' },
          R('Bent Over Barbell Row', 4, 8, 70, 8, 120),
          R('Incline Dumbbell Press', 2, 10, 28, 8),
          R('Pullups', 3, 8, undefined, 8),
          R('Side Lateral Raise', 3, 15, 10, 9),
        ],
        true,
      ],
      4: [
        'Lower A',
        [
          R('Barbell Squat', 4, 5, 100, 8, 180),
          R('Romanian Deadlift', 2, 8, 90, 8, 150),
          R('Leg Press', 3, 12, 160, 9),
        ],
        true,
      ],
      5: [
        'Upper B',
        [
          R('Barbell Shoulder Press', 3, 6, 60, 8, 150),
          R('Wide-Grip Lat Pulldown', 4, 10, 65, 8),
          { ...R('EZ-Bar Skullcrusher', 3, 12, 35, 9), group: 'A' },
          { ...R('Preacher Curl', 3, 12, 30, 9), group: 'A' },
        ],
      ],
      6: [
        'Lower B',
        [
          R('Split Squat with Dumbbells', 3, 10, 20, 8),
          R('Lying Leg Curls', 3, 12, 35, 9),
          R('Leg Extensions', 3, 12, 40, 9),
          R('Weighted plank', 3, 45),
        ],
      ],
    },
    [
      act(2, 'mobility', 15, 'light', 'after'),
      act(4, 'walk', 30, 'light', 'any'),
      act(6, 'run', 35, 'moderate', 'any'),
    ],
  );
}

/** A plain 2 / 3 / 4-day template for any other client (name from the roster row). */
function genericDraft(c: CoachClient): Program {
  const n = Math.min(4, Math.max(2, c.planned || 3));
  const upper: Row[] = [
    R('Barbell Bench Press - Medium Grip', 3, 8, 60),
    R('Bent Over Barbell Row', 3, 10, 50),
    R('Barbell Shoulder Press', 3, 8, 35),
    R('Wide-Grip Lat Pulldown', 3, 10, 45),
  ];
  const lower: Row[] = [
    R('Barbell Squat', 4, 6, 80),
    R('Romanian Deadlift', 3, 8, 70),
    R('Leg Press', 3, 12, 120),
    R('Standing Calf Raises', 3, 12, 50),
  ];
  const slots = n === 2 ? [2, 5] : n === 3 ? [1, 3, 5] : [2, 4, 5, 6];
  const days: Record<number, [string, Row[], boolean?]> = {};
  slots.forEach(
    (d, i) => (days[d] = [i % 2 === 0 ? 'Upper' : 'Lower', i % 2 === 0 ? upper : lower, i === 0]),
  );
  const p = program(c.program, 'trainer-iryna', days, [
    act(slots[0], 'mobility', 15, 'light', 'after'),
  ]);
  if (c.restriction && /overhead/i.test(c.restriction)) {
    // A shared restriction against an exercise in the plan: the check must name it (Andriy, shoulder, overhead press).
    const day = slots[0];
    p.items = p.items.map((i) =>
      i.day === day && i.name === 'Barbell Bench Press - Medium Grip'
        ? { ...i, name: 'Barbell Shoulder Press' }
        : i,
    );
  }
  return p;
}

export function buildBundle(
  c: CoachClient,
  w: Pick<WorldData, 'clients' | 'trainer'>,
): ProgramBundle {
  const isOleh = c.id === 'c1';
  const draft = isOleh ? olehDraft(w.trainer.id) : genericDraft(c);
  // Same item ids as the draft: the diff is "1 change" (the paused bench), never a rewrite of the whole week.
  const live = isOleh
    ? {
        ...draft,
        items: normalizeItems(draft.items.filter((i) => i.name !== 'Paused bench press')),
      }
    : { ...draft };
  const liveVersion = isOleh ? 4 : 2;
  const others = w.clients.filter((x) => x.id !== c.id && !x.invite && x.program === c.program);
  const trainerDays: Dow[] = [...c.trainerDays];
  return {
    clientId: c.id,
    rev: 1,
    programName: c.program,
    draftVersion: liveVersion + 1,
    liveVersion,
    live,
    draft: isOleh ? draft : { ...draft },
    trainerName: w.trainer.name,
    trainerDays,
    sharedWith: others.map((x) => ({ clientId: x.id, name: x.name, version: liveVersion })),
    versions: isOleh
      ? [
          { n: 5, at: null, by: w.trainer.name, summary: 'Adds 1 set of paused bench to Upper A' },
          {
            n: 4,
            at: FIXTURE_NOW - 43 * DAY,
            by: w.trainer.name,
            summary: 'Start of block 3: +1 back set',
          },
          { n: 3, at: FIXTURE_NOW - 71 * DAY, by: w.trainer.name, summary: 'Moved to 4 days' },
        ]
      : [{ n: liveVersion, at: FIXTURE_NOW - 30 * DAY, by: w.trainer.name, summary: '' }],
    sentAt: null,
    seen: null,
  };
}

/** The ISO weekdays of a dow list (for stories). */
export const isoDays = (d: readonly Dow[]): number[] => d.map((x) => ISO_OF_DOW[x]);

/** A world snapshot for stories / tests that need only the roster. */
export const fixtureWorldLite = (): Pick<WorldData, 'clients' | 'trainer'> => {
  const w = buildFixtureWorld();
  return { clients: w.clients, trainer: w.trainer };
};

/** Days a trainer can copy from: own templates, then other clients' programs. The real port (`data/firestore/programPort.ts`) offers the days of the clients already opened on this device; the trainer's OWN template library has no store yet (open item). */
export function libraryEntries(
  w: Pick<WorldData, 'clients' | 'trainer'>,
  exceptClientId: string,
): LibraryEntry[] {
  const out: LibraryEntry[] = [];
  const facts = (p: Program, d: number) => {
    const its = p.items.filter((i) => i.day === d && i.kind === 'strength');
    return { exercises: its.length, sets: its.reduce((n, i) => n + (i.bare ? 0 : i.sets), 0) };
  };
  const tpl = olehDraft(w.trainer.id);
  for (const d of [2, 4]) {
    out.push({
      key: `tpl-${d}`,
      kind: 'template',
      name: 'Upper/Lower 4x',
      dayName: tpl.dayNames[String(d)] ?? '',
      ...facts(tpl, d),
      by: w.trainer.name,
      program: tpl,
      day: d,
    });
  }
  for (const c of w.clients
    .filter((x) => x.id !== exceptClientId && !x.invite && x.mode !== 'program')
    .slice(0, 5)) {
    const p = genericDraft(c);
    const d = Number(Object.keys(p.dayNames)[0]);
    out.push({
      key: `cl-${c.id}`,
      kind: 'client',
      name: c.program,
      dayName: p.dayNames[String(d)] ?? '',
      ...facts(p, d),
      clientId: c.id,
      clientName: c.name,
      program: p,
      day: d,
    });
  }
  return out;
}
