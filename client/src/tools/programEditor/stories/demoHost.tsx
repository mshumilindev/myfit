/**
 * A complete demo host for stories and tests: a literal exercise catalog (no app data), the Coach dictionaries for the
 * words (five locales), and a small program. Stories and tests may import dictionaries; the tool's runtime may not
 * (architecture.test.ts). This file is also the shortest example of what a host provides.
 */
import { useState } from 'react';
import { MusclePickerMap } from '../../../components/Muscle';
import { LOCALES, type LocaleId } from '../../../i18n';
import { PG_LOCALES } from '../../../i18n/coachProgram';
import { emptyDoc, type MuscleGroup, type ProgramDoc } from '../model/doc';
import { addBareExercise, addItem, setRowMode, startDay } from '../model/ops';
import type {
  ActivityKind,
  CatalogHit,
  EditorMode,
  ExerciseCatalog,
  ExerciseFacts,
  ExerciseSearch,
  LibraryDay,
  ProgramEditorHost,
} from '../host';
import { ProgramEditor, type ProgramEditorProps } from '../ui/ProgramEditor';

interface Row {
  name: string;
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: string | null;
  force?: 'push' | 'pull';
  /** A custom exercise: no picture. */
  noImage?: boolean;
}

const ROWS: Row[] = [
  {
    name: 'Barbell Bench Press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'barbell',
    force: 'push',
  },
  {
    name: 'Incline Dumbbell Press',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'dumbbell',
    force: 'push',
  },
  {
    name: 'Barbell Shoulder Press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'barbell',
    force: 'push',
  },
  { name: 'Lateral Raise', primary: 'shoulders', equipment: 'dumbbell' },
  { name: 'Triceps Pushdown', primary: 'triceps', equipment: 'cable', force: 'push' },
  {
    name: 'Pull-Up',
    primary: 'lats',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    force: 'pull',
  },
  {
    name: 'Barbell Row',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'barbell',
    force: 'pull',
  },
  { name: 'Dumbbell Curl', primary: 'biceps', equipment: 'dumbbell', force: 'pull' },
  {
    name: 'Barbell Squat',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    force: 'push',
  },
  {
    name: 'Leg Press',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'machine',
    force: 'push',
  },
  {
    name: 'Romanian Deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'lower_back'],
    equipment: 'barbell',
    force: 'pull',
  },
  { name: 'Hip Thrust', primary: 'glutes', equipment: 'barbell' },
  { name: 'Standing Calf Raise', primary: 'calves', equipment: 'machine' },
  { name: 'Plank', primary: 'core', equipment: 'bodyweight' },
  { name: 'Cable Crunch', primary: 'core', equipment: 'cable' },
  { name: 'Zottman Curl Variation', primary: 'biceps', equipment: 'dumbbell', noImage: true },
];

const key = (s: string) => s.trim().toLowerCase();
const BY_NAME = new Map(ROWS.map((r) => [key(r.name), r]));
const img = (r: Row) =>
  r.noImage
    ? undefined
    : `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>')}`;

const factsOf = (name: string): ExerciseFacts => {
  const r = BY_NAME.get(key(name));
  const secondary = r?.secondary ?? [];
  return {
    name,
    primary: r?.primary ?? null,
    secondary,
    muscles: r ? [r.primary, ...secondary] : [],
    equipment: r?.equipment ?? null,
    image: r ? img(r) : undefined,
    force: r?.force ?? null,
  };
};

/** A literal catalog: enough to exercise every path of the tool without any app data. */
export const demoCatalog: ExerciseCatalog = {
  facts: factsOf,
  search(q: ExerciseSearch): CatalogHit[] {
    const text = key(q.query ?? '');
    const skip = new Set((q.exclude ?? []).map(key));
    return ROWS.filter(
      (r) =>
        !skip.has(key(r.name)) &&
        (!q.muscle || r.primary === q.muscle) &&
        (!text || key(r.name).includes(text)),
    )
      .slice(0, q.limit ?? 8)
      .map((r) => ({ name: r.name, muscle: r.primary, equipment: r.equipment, image: img(r) }));
  },
};

export const DEMO_ACTIVITIES: ActivityKind[] = [
  { key: 'run', icon: 'person-simple-run', category: 'conditioning' },
  { key: 'cycle', icon: 'bicycle', category: 'conditioning' },
  { key: 'swim', icon: 'person-simple-swim', category: 'conditioning' },
  { key: 'yoga', icon: 'person-simple-tai-chi', category: 'recovery' },
  { key: 'mobility', icon: 'arrows-out-line-horizontal', category: 'recovery' },
];

export const DEMO_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
];

/** A week: Monday upper (superset, one bare row), Wednesday lower, Friday defined by muscles. */
export function demoDoc(name = 'Upper / Lower 3x'): ProgramDoc {
  let d = emptyDoc(name);
  d = startDay(d, 1, 'Upper A');
  d = startDay(d, 3, 'Lower A');
  const add = (
    day: number,
    n: string,
    sets: number,
    reps: number,
    extra: Partial<ProgramDoc['items'][number]> = {},
  ) =>
    (d = addItem(d, {
      day,
      name: n,
      kind: 'strength',
      sets,
      reps,
      durationMin: null,
      equipment: factsOf(n).equipment ? [factsOf(n).equipment!] : [],
      ...extra,
    }));
  add(1, 'Barbell Bench Press', 4, 6, { targetWeight: 80, targetRpe: 8, restSec: 150 });
  add(1, 'Barbell Row', 4, 8);
  add(1, 'Lateral Raise', 3, 12);
  add(1, 'Dumbbell Curl', 3, 10);
  add(3, 'Barbell Squat', 4, 5, { targetWeight: 100 });
  add(3, 'Romanian Deadlift', 3, 8);
  add(3, 'Leg Press', 3, 12);
  const bare = addBareExercise(d, 3, 'Plank', demoCatalog);
  d = bare.program;
  d = setRowMode(d, bare.id, true);
  d = startDay(d, 5, 'Arms and shoulders');
  d = { ...d, targetMuscles: { '5': ['biceps', 'triceps', 'shoulders'] } };
  d = {
    ...d,
    activities: [
      { id: 'act-1', day: 2, type: 'run', minutes: 30, effort: 'moderate', when: 'any' },
    ],
  };
  return d;
}

export const demoLibrary = (): LibraryDay[] => {
  const program = demoDoc('Beginner full body');
  return [
    {
      key: 't1',
      kind: 'template',
      name: 'Beginner full body',
      dayName: 'Upper A',
      exercises: 4,
      sets: 14,
      program,
      day: 1,
    },
    {
      key: 'c1',
      kind: 'client',
      name: 'Strength block',
      dayName: 'Lower A',
      exercises: 4,
      sets: 13,
      clientName: 'Maria Kovalenko',
      program,
      day: 3,
    },
  ];
};

export interface DemoHostOptions extends Partial<Omit<ProgramEditorHost, 'labels' | 'words'>> {
  locale?: LocaleId;
  mode?: EditorMode;
}

/** The demo host: literal catalog, the Coach dictionary of `locale`, the real anatomy figure. */
export function demoHost({
  locale = 'en',
  mode = 'coach',
  ...over
}: DemoHostOptions = {}): ProgramEditorHost {
  const t = LOCALES[locale];
  return {
    mode,
    catalog: demoCatalog,
    labels: PG_LOCALES[locale],
    words: {
      muscleGroups: t.muscleGroups,
      actType: t.actType,
      actEffortLevel: t.actEffortLevel,
      equipmentLabel: (id) => (t.equipmentNames as Record<string, string>)[id] ?? id,
    },
    activities: DEMO_ACTIVITIES,
    equipment: DEMO_EQUIPMENT,
    library: demoLibrary(),
    slots: { muscleMap: MusclePickerMap },
    ...over,
  };
}

/** Uncontrolled wrapper for stories: keeps the doc in state so edits, undo and redo work on the canvas. */
export function DemoEditor({
  doc: initial,
  host,
  onDoc,
  ...rest
}: Omit<ProgramEditorProps, 'doc' | 'onChange' | 'host'> & {
  doc?: ProgramDoc;
  host?: ProgramEditorHost;
  onDoc?: (d: ProgramDoc) => void;
}) {
  const [doc, setDoc] = useState<ProgramDoc>(() => initial ?? demoDoc());
  const [h] = useState(() => host ?? demoHost());
  return (
    <ProgramEditor
      {...rest}
      doc={doc}
      host={h}
      onChange={(next) => {
        setDoc(next);
        onDoc?.(next);
      }}
    />
  );
}
