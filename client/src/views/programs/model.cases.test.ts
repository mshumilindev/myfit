import { beforeEach, describe, expect, it } from 'vitest';
import { PRISTINE, reseed } from '../__fixtures__/viewKit';
import {
  type Program,
  type ProgramItem,
  compactProgramDaySummary,
  dayActivities,
  dayExercises,
  dayItems,
  dayMode,
  dayName,
  duplicateOf,
  effectiveSets,
  freshProgram,
  isBare,
  isDayComplete,
  isTrainingDay,
  normalizeItems,
  normalizeProgram,
  readiness,
  sanitizeActivities,
  sanitizeTargetMuscles,
  setCount,
  toSaved,
  trainingDays,
} from './model';

const item = (over: Partial<ProgramItem> = {}): ProgramItem => ({
  id: 'i1',
  day: 1,
  position: 0,
  name: 'Barbell Squat',
  kind: 'strength',
  sets: 3,
  reps: 5,
  durationMin: null,
  equipment: [],
  ...over,
});
const prog = (over: Partial<Program> = {}): Program => ({
  ...freshProgram('P'),
  id: 'p1',
  ...over,
});

beforeEach(() => {
  reseed({ ...PRISTINE });
});

describe('program rows: bare and set counting', () => {
  it('a strength row with no sets, or flagged bare, is bare; other kinds never are', () => {
    expect(isBare({ kind: 'strength', sets: 0 })).toBe(true);
    expect(isBare({ kind: 'strength', sets: 3, bare: true })).toBe(true);
    expect(isBare({ kind: 'strength', sets: 3 })).toBe(false);
    expect(isBare({ kind: 'cardio', sets: 0 })).toBe(false);
  });

  it('only a non-bare strength row asks for sets', () => {
    expect(effectiveSets({ kind: 'strength', sets: 4 })).toBe(4);
    expect(effectiveSets({ kind: 'strength', sets: 4, bare: true })).toBe(0);
    expect(effectiveSets({ kind: 'cardio', sets: 4 })).toBe(0);
    expect(
      setCount([
        item({ sets: 3 }),
        item({ sets: 2, bare: true }),
        item({ kind: 'cardio', sets: 9 }),
      ]),
    ).toBe(3);
  });

  it('the day summary prints sets x reps for one lift, only the total for several, minutes without lifts, nothing when bare', () => {
    expect(compactProgramDaySummary([item({ sets: 3, reps: 5 })])).toBe('3 × 5');
    expect(compactProgramDaySummary([item({ sets: 3, reps: 5 }), item({ sets: 2, reps: 8 })])).toBe(
      '5',
    );
    expect(compactProgramDaySummary([item({ sets: 3, reps: 0 })])).toBe('3');
    expect(compactProgramDaySummary([item({ bare: true })])).toBe('');
    expect(
      compactProgramDaySummary([
        item({ kind: 'cardio', durationMin: 20 }),
        item({ kind: 'warmup', durationMin: null }),
      ]),
    ).toBe('30 min');
    expect(compactProgramDaySummary([])).toBe('0 min');
  });
});

describe('program sanitizing', () => {
  it('target muscles keep only string lists per day and drop empty or malformed days', () => {
    expect(sanitizeTargetMuscles({ 1: ['chest', 3, 'back'], 2: [], 3: 'chest', 4: [7] })).toEqual({
      1: ['chest', 'back'],
    });
    expect(sanitizeTargetMuscles(null)).toEqual({});
    expect(sanitizeTargetMuscles('x')).toEqual({});
  });

  it('planned activities: bad rows are dropped, numbers are clamped and rounded, unknown enums default', () => {
    const out = sanitizeActivities([
      null,
      'x',
      { id: 'a', day: 2, type: 'run', minutes: 30.4, effort: 'hard', when: 'after' },
      { day: 3, type: 'yoga', minutes: 9999, effort: 'wild', when: 'never' },
      { id: 'b', day: 8, type: 'run', minutes: 30 },
      { id: 'c', day: 0, type: 'run', minutes: 30 },
      { id: 'd', day: 1.5, type: 'run', minutes: 30 },
      { id: 'e', day: 1, type: 'no-such-type', minutes: 30 },
      { id: 'f', day: 1, type: 'run', minutes: 0 },
      { id: 'g', day: 1, type: 'run', minutes: Infinity },
      { id: 'h', day: 1, type: 'run', minutes: '30' },
      { id: 'i', day: 1, type: 5, minutes: 30 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'a',
      day: 2,
      type: 'run',
      minutes: 30,
      effort: 'hard',
      when: 'after',
    });
    expect(out[1]).toMatchObject({
      day: 3,
      type: 'yoga',
      minutes: 600,
      effort: 'moderate',
      when: 'any',
    });
    expect(out[1].id).toMatch(/[0-9a-f-]{36}/);
    expect(sanitizeActivities(undefined)).toEqual([]);
    expect(sanitizeActivities({ day: 1 })).toEqual([]);
  });

  it('at most 28 planned activities survive', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `a${i}`,
      day: 1 + (i % 7),
      type: 'run',
      minutes: 20,
    }));
    const out = sanitizeActivities(many);
    expect(out).toHaveLength(28);
    expect(out[27].id).toBe('a27');
  });

  it('items are ordered by day then position, renumbered per day, and get an equipment list', () => {
    const out = normalizeItems([
      item({ id: 'c', day: 2, position: 7 }),
      item({ id: 'b', day: 1, position: 5, equipment: undefined as never }),
      item({ id: 'a', day: 1, position: 2 }),
    ]);
    expect(out.map((i) => [i.id, i.day, i.position])).toEqual([
      ['a', 1, 0],
      ['b', 1, 1],
      ['c', 2, 0],
    ]);
    expect(out[1].equipment).toEqual([]);
  });

  it('warm-up exercises are kept on warm-up rows only', () => {
    const warm = [{ id: 'w', name: 'Arm circles', reps: 10 }];
    const out = normalizeItems([
      item({ id: 'a', kind: 'warmup', warmupItems: warm }),
      item({ id: 'b', day: 2, kind: 'strength', warmupItems: warm }),
    ]);
    expect(out.find((i) => i.id === 'a')?.warmupItems).toHaveLength(1);
    expect(out.find((i) => i.id === 'b')?.warmupItems).toBeUndefined();
  });

  it('normalizing a program fills the missing parts and cleans activities only when present', () => {
    const bare = normalizeProgram({
      ...prog(),
      dayNames: undefined as never,
      items: undefined as never,
    });
    expect(bare.dayNames).toEqual({});
    expect(bare.items).toEqual([]);
    expect('activities' in bare).toBe(false);
    const withActs = normalizeProgram(
      prog({
        activities: [{ id: 'x', day: 9, type: 'run', minutes: 5, effort: 'light', when: 'any' }],
      }),
    );
    expect(withActs.activities).toEqual([]);
  });
});

describe('program days', () => {
  const p = prog({
    dayNames: { '1': ' Push ', '3': '', '5': 'Legs' },
    targetMuscles: { '3': ['chest'], '5': ['quads'] },
    items: [
      item({ id: 'b', day: 1, position: 1, name: 'B' }),
      item({ id: 'a', day: 1, position: 0, name: 'A' }),
      item({ id: 'c', day: 1, position: 2, kind: 'cardio', name: 'Run' }),
    ],
    activities: [
      { id: 'x', day: 1, type: 'run', minutes: 20, effort: 'light', when: 'any' },
      { id: 'y', day: 2, type: 'yoga', minutes: 20, effort: 'light', when: 'any' },
    ],
  });

  it('items come back in position order; exercises exclude cardio and markers', () => {
    expect(dayItems(p, 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(dayExercises(p, 1).map((i) => i.id)).toEqual(['a', 'b']);
    expect(dayItems(p, 2)).toEqual([]);
  });

  it('a day name is trimmed and empty when absent; activities are listed per day', () => {
    expect(dayName(p, 1)).toBe('Push');
    expect(dayName(p, 2)).toBe('');
    expect(dayName({ ...p, dayNames: undefined as never }, 1)).toBe('');
    expect(dayActivities(p, 1).map((a) => a.id)).toEqual(['x']);
    expect(dayActivities(prog(), 1)).toEqual([]);
  });

  it('a day trains when it has items, muscles or a name; the mode follows the items', () => {
    expect(isTrainingDay(p, 1)).toBe(true);
    expect(isTrainingDay(p, 3)).toBe(true);
    expect(isTrainingDay(p, 5)).toBe(true);
    expect(isTrainingDay(p, 2)).toBe(false);
    expect(isTrainingDay(prog({ targetMuscles: undefined as never }), 2)).toBe(false);
    expect(trainingDays(p)).toEqual([1, 3, 5]);
    expect(dayMode(p, 1)).toBe('exercises');
    expect(dayMode(p, 3)).toBe('muscles');
  });

  it('a day is complete only with a name and either items or muscles', () => {
    expect(isDayComplete(p, 1)).toBe(true);
    expect(isDayComplete(p, 5)).toBe(true);
    expect(isDayComplete(p, 3)).toBe(false);
    expect(isDayComplete(prog({ dayNames: { '2': 'Named' } }), 2)).toBe(false);
    expect(
      isDayComplete(prog({ dayNames: { '2': 'N' }, targetMuscles: undefined as never }), 2),
    ).toBe(false);
  });

  it('readiness names the first problem: no days, then an unnamed day, then an empty one', () => {
    expect(readiness(prog())).toEqual({ ok: false, reason: 'no-days' });
    expect(readiness(p)).toEqual({ ok: false, reason: 'unnamed', day: 3 });
    expect(readiness(prog({ dayNames: { '2': 'Rest-ish' } }))).toEqual({
      ok: false,
      reason: 'empty',
      day: 2,
    });
    expect(readiness(prog({ dayNames: { '1': 'Push' }, items: [item()] }))).toEqual({ ok: true });
  });
});

describe('saving and duplicating', () => {
  beforeEach(() => reseed({ ...PRISTINE }));

  it('toSaved trims, clamps and drops what is not stored', () => {
    const saved = toSaved(
      prog({
        name: '   ',
        weeks: 99,
        dayNames: { '1': '  Push day  ', '2': '   ' },
        targetMuscles: { '1': ['chest'], '2': ['back'] },
        items: [
          item({
            id: '',
            name: ' Squat ',
            day: 9,
            position: undefined as never,
            note: '  cue  ',
            targetWeight: 80,
            targetRpe: 8,
            restSec: 90,
            dropLast: true,
            bare: true,
          }),
          item({ id: 'blank', name: '   ' }),
          item({
            id: 'w',
            day: 0,
            kind: 'warmup',
            name: 'Warm-up',
            warmupItems: [{ id: 'x', name: 'Arm circles', reps: 10 }],
            note: '   ',
          }),
        ],
      }),
      'uid1',
      'Untitled',
    );
    expect(saved.name).toBe('Untitled');
    expect(saved.weeks).toBe(52);
    expect(saved.authorId).toBe('uid1');
    expect(saved.dayNames).toEqual({ '1': 'Push day' });
    expect(saved.items).toHaveLength(2);
    expect(saved.items[0]).toMatchObject({
      name: 'Squat',
      day: 7,
      position: 0,
      note: 'cue',
      targetWeight: 80,
      targetRpe: 8,
      restSec: 90,
      dropLast: true,
      bare: true,
    });
    expect(saved.items[0].id).toMatch(/[0-9a-f-]{36}/);
    expect(saved.items[1]).toMatchObject({ day: 1, kind: 'warmup' });
    expect(saved.items[1].warmupItems).toHaveLength(1);
    expect('note' in saved.items[1]).toBe(false);
    // day 1 has items, so its stored muscles are dropped; the muscles-only day 2 keeps them
    expect(saved.targetMuscles).toEqual({ '2': ['back'] });
    expect(saved.status).toBe('draft');
  });

  it('weeks: 0 means ongoing and a missing value defaults to 8', () => {
    expect(toSaved(prog({ weeks: 0 }), 'u', 'x').weeks).toBe(0);
    expect(toSaved(prog({ weeks: undefined as never }), 'u', 'x').weeks).toBe(8);
    expect(toSaved(prog({ weeks: -4 }), 'u', 'x').weeks).toBe(1);
  });

  it('planned activities are written only when there are some, and a sealed list is carried over untouched', () => {
    const acts = [
      { id: 'a', day: 1, type: 'run', minutes: 20, effort: 'light' as const, when: 'any' as const },
    ];
    expect(toSaved(prog({ activities: acts }), 'u', 'x').activities).toEqual(acts);
    expect('activities' in toSaved(prog({ activities: [] }), 'u', 'x')).toBe(false);
    const enc = { v: 1, iv: 'a', ct: 'b' } as never;
    const sealed = toSaved(prog({ activities: undefined, activitiesEnc: enc }), 'u', 'x');
    expect(sealed.activitiesEnc).toBe(enc);
    expect('activities' in sealed).toBe(false);
    expect('activitiesEnc' in toSaved(prog(), 'u', 'x')).toBe(false);
  });

  it('days per week counts the training days and is at least one', () => {
    expect(toSaved(prog(), 'u', 'x').daysPerWeek).toBe(1);
    expect(
      toSaved(
        prog({ dayNames: { '1': 'A', '2': 'B' }, items: [item({ day: 1 }), item({ day: 2 })] }),
        'u',
        'x',
      ).daysPerWeek,
    ).toBe(2);
  });

  it('a duplicate is a new draft with new ids; grouped rows stay grouped among themselves', () => {
    const src = prog({
      status: 'active',
      items: [
        item({ id: 'a', groupId: 'g' }),
        item({ id: 'b', groupId: 'g', position: 1 }),
        item({ id: 'c', groupId: 'h', position: 2 }),
        item({ id: 'd', position: 3 }),
      ],
      activities: [{ id: 'x', day: 1, type: 'run', minutes: 20, effort: 'light', when: 'any' }],
    });
    const copy = duplicateOf(src, 'Copy');
    expect(copy).toMatchObject({ name: 'Copy', status: 'draft' });
    expect(copy.id).not.toBe(src.id);
    expect(copy.items.map((i) => i.id)).not.toContain('a');
    const [a, b, c, d] = copy.items;
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupId).not.toBe('g');
    expect(c.groupId).not.toBe(a.groupId);
    expect(d.groupId).toBeNull();
    expect(copy.activities?.[0].id).not.toBe('x');
    expect(copy.activities?.[0]).toMatchObject({ type: 'run', minutes: 20 });
    expect('activities' in duplicateOf(prog(), 'N')).toBe(false);
    expect(src.items[0].id).toBe('a');
  });
});
