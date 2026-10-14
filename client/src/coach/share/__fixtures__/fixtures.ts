/**
 * Share source for stories, tests and the dev server until the real adapter exists (see port.ts). The library is the
 * app's real bundled catalogue; programs, gyms, activities and the per-client data are seeded from the coach world
 * fixtures (Wed 7 Oct 2026 09:05, trainer Iryna).
 */
import { FIXTURE_NOW, buildFixtureWorld } from '../../data/__fixtures__/fixtures';
import type { WorldData } from '../../data/port';
import type { ClientWorkouts, ExerciseResult } from '../../domain/workouts';
import { liftRow } from '../../domain/workouts';
import { DAY } from '../../domain/time';
import type { CoachClient } from '../../domain/types';
import { richExerciseByName } from '../../../data/exercises';
import { catalogEquipment, catalogExercises } from '../library';
import type { ShareSourcePort } from '../port';
import type {
  ActivitySource,
  ClientShareData,
  LibGym,
  ProgramSource,
  ResultSource,
  ShareSource,
  WorkoutSource,
} from '../types';

/** Equipment ids of the real catalogue that each fixture gym has. */
const COMMON = [
  'bench-flat',
  'bench-adjustable',
  'rack-power',
  'barbell-olympic',
  'barbell-ez',
  'dumbbell-fixed',
  'cable-crossover',
  'cardio-rower',
  'cardio-treadmill',
  'kettlebell-cast',
];
export const FIXTURE_GYMS: LibGym[] = [
  {
    id: 'iron-yard',
    name: 'Iron Yard',
    city: 'Kyiv',
    amenities: ['sauna', 'pool', 'massage', 'cafe', 'stretchArea'],
    machines: 148,
    hours: '06:00-23:00',
    equipmentIds: [...COMMON, 'cable-lat-tower', 'bench-preacher', 'm-leg-press', 'smith-machine'],
    shareable: true,
  },
  {
    id: 'fithub-pozniaky',
    name: 'FitHub Pozniaky',
    city: 'Kyiv',
    amenities: ['sauna', 'cafe', 'juiceBar'],
    machines: 96,
    hours: '07:00-22:00',
    equipmentIds: COMMON.slice(0, 8),
    shareable: true,
  },
  {
    id: 'sport-life-obolon',
    name: 'Sport Life Obolon',
    city: 'Kyiv',
    amenities: ['pool', 'steam'],
    machines: 64,
    hours: '07:00-23:00',
    equipmentIds: ['cardio-treadmill', 'cardio-rower', 'dumbbell-fixed'],
    shareable: true,
  },
  {
    id: 'home-gym',
    name: 'Home gym',
    city: '',
    amenities: [],
    machines: 3,
    equipmentIds: ['rack-power', 'barbell-olympic', 'bench-flat'],
    shareable: false,
  },
];

/** The world fixtures name lifts the way a person logs them; the catalogue has its own canonical names. */
const LOG_NAMES: Record<string, string> = {
  'Bench press': 'Barbell Bench Press - Medium Grip',
  'Bent-over row': 'Bent Over Barbell Row',
  'Incline dumbbell press': 'Incline Dumbbell Press',
  Deadlift: 'Barbell Deadlift',
  Squat: 'Barbell Squat',
  'Lat pulldown': 'Wide-Grip Lat Pulldown',
  'Preacher curl': 'Preacher Curl',
  'Skull crusher': 'EZ-Bar Skullcrusher',
  'Romanian deadlift': 'Romanian Deadlift',
  'Standing calf raise': 'Standing Calf Raises',
  'Lying leg curl': 'Lying Leg Curls',
  'Lateral raise': 'Side Lateral Raise',
};
const exId = (name: string) => richExerciseByName(LOG_NAMES[name] ?? name)?.id;
const exImage = (name: string) => richExerciseByName(LOG_NAMES[name] ?? name)?.images?.[0];
const row = (name: string, sets: number, reps?: string, kg?: string) => ({
  name,
  exerciseId: exId(name),
  sets,
  reps,
  kg,
});

export const FIXTURE_PROGRAMS: ProgramSource[] = [
  {
    id: 'upper-lower-4x',
    name: 'Upper/Lower 4x',
    weeks: 12,
    version: 'v5',
    assignedTo: ['c1', 'c8'],
    days: [
      {
        name: 'Upper A',
        wd: 'Tue',
        rows: [
          row('Barbell Bench Press - Medium Grip', 4, '5', '100 kg'),
          row('Bent Over Barbell Row', 4, '8', '70 kg'),
          row('Dumbbell Bench Press', 3, '10', '30 kg'),
          row('Wide-Grip Lat Pulldown', 3, '10', '55 kg'),
        ],
      },
      {
        name: 'Lower A',
        wd: 'Thu',
        rows: [
          row('Barbell Squat', 4, '6', '110 kg'),
          row('Romanian Deadlift', 3, '8', '95 kg'),
          row('Leg Press', 3, '12', '180 kg'),
          row('Standing Calf Raises', 4, '12', '80 kg'),
        ],
      },
      {
        name: 'Upper B',
        wd: 'Fri',
        rows: [
          row('Standing Military Press', 4, '6', '55 kg'),
          row('Pullups', 3, '8'),
          row('Face Pull', 3, '15', '25 kg'),
          row('EZ-Bar Skullcrusher', 3, '10', '35 kg'),
        ],
      },
      {
        name: 'Lower B',
        wd: 'Sat',
        rows: [
          row('Barbell Deadlift', 3, '5', '150 kg'),
          row('Barbell Lunge', 3, '10', '60 kg'),
          row('Lying Leg Curls', 3, '12', '45 kg'),
        ],
      },
    ],
  },
  {
    id: 'glute-focus-3x',
    name: 'Glute Focus 3x',
    weeks: 10,
    version: 'v3',
    assignedTo: ['c2'],
    days: [
      {
        name: 'Glutes A',
        wd: 'Mon',
        rows: [
          row('Romanian Deadlift', 4, '8', '70 kg'),
          row('Barbell Hip Thrust', 3, '10', '90 kg'),
          row('Leg Press', 3, '12', '120 kg'),
          row('Standing Calf Raises', 0),
        ],
      },
      { name: 'Posterior chain', wd: 'Fri', muscles: ['glutes', 'hamstrings', 'core'] },
    ],
  },
  {
    id: 'full-body-3x',
    name: 'Full Body 3x',
    weeks: 6,
    version: 'v4',
    assignedTo: [],
    template: true,
    days: [
      {
        name: 'Day A',
        wd: 'Mon',
        rows: [
          row('Barbell Squat', 0),
          row('Barbell Bench Press - Medium Grip', 0),
          row('Bent Over Barbell Row', 0),
        ],
      },
      { name: 'Day C', wd: 'Fri', muscles: ['chest', 'back', 'quads', 'shoulders'] },
    ],
  },
];

const LOOP: [number, number][] = Array.from({ length: 41 }, (_, i) => {
  const a = (i / 40) * Math.PI * 2;
  const wob = 1 + 0.12 * Math.sin(a * 3) + 0.06 * Math.cos(a * 5);
  return [50.4437 + Math.sin(a) * 0.0042 * wob, 30.5766 + Math.cos(a) * 0.0075 * wob] as [
    number,
    number,
  ];
});
const ACTIVITIES: Record<string, ActivitySource[]> = {
  c1: [
    {
      id: 'c1-a1',
      at: FIXTURE_NOW - 3 * DAY,
      type: 'run',
      icon: 'person-simple-run',
      minutes: 34,
      effort: 'moderate',
      km: 5.1,
      avgHr: 148,
      route: 'Hidropark',
      points: LOOP,
    },
    {
      id: 'c1-a2',
      at: FIXTURE_NOW - 6 * DAY,
      type: 'walk',
      icon: 'person-simple-walk',
      minutes: 40,
      effort: 'light',
      km: 3.4,
    },
    {
      id: 'c1-a3',
      at: FIXTURE_NOW - 1 * DAY,
      type: 'yoga',
      icon: 'yoga',
      minutes: 15,
      effort: 'light',
    },
  ],
  c2: [
    {
      id: 'c2-a1',
      at: FIXTURE_NOW - 2 * DAY,
      type: 'cycle',
      icon: 'bicycle',
      minutes: 45,
      effort: 'moderate',
      km: 17.8,
      avgHr: 139,
    },
  ],
  c7: [
    {
      id: 'c7-a1',
      at: FIXTURE_NOW - 2 * DAY,
      type: 'swim',
      icon: 'person-simple-swim',
      minutes: 40,
      effort: 'hard',
      km: 1.6,
    },
  ],
};

const WEEKLY: Record<string, Record<string, number>> = {
  c1: {
    chest: 14,
    back: 15,
    lats: 12,
    shoulders: 11,
    quads: 12,
    hamstrings: 8,
    glutes: 6,
    biceps: 8,
    triceps: 9,
    calves: 8,
    core: 6,
  },
};
const weeklyOf = (id: string): Record<string, number> =>
  WEEKLY[id] ?? {
    chest: 9,
    back: 11,
    lats: 8,
    shoulders: 8,
    quads: 10,
    hamstrings: 7,
    glutes: 9,
    biceps: 6,
    triceps: 6,
    calves: 6,
    core: 6,
  };

const topText = (top: string) => top.replace(/x/i, ' kg x ').replace(' x ', ' × ');

function resultsOf(ex: readonly ExerciseResult[]): ResultSource[] {
  return ex.flatMap((x) => {
    const r = liftRow(x);
    if (!r) return [];
    const best = x.sessions.reduce((a, b) => (b.e1rm >= a.e1rm ? b : a));
    return [
      {
        id: x.id,
        name: x.name,
        exerciseId: exId(x.name),
        series: x.sessions.slice(-8).map((s) => s.e1rm),
        best: topText(best.top),
        e1rm: r.e1rm,
        change: r.change,
        sessions: x.sessions.length,
        image: exImage(x.name),
      },
    ];
  });
}

function workoutsOf(w: ClientWorkouts | undefined, gym: string): WorkoutSource[] {
  if (!w) return [];
  return w.entries.slice(0, 40).map((e) => ({
    id: e.id,
    at: e.at,
    title: e.title,
    minutes: e.minutes,
    sets: e.sets,
    tonnageKg: e.tonnageKg,
    gym,
    withTrainer: e.withTrainer,
    rows: w.exercises.flatMap((x) => {
      const s = x.sessions.find((y) => y.at === e.at);
      return s ? [{ name: x.name, top: topText(s.top), image: exImage(x.name) }] : [];
    }),
  }));
}

function clientData(c: CoachClient, world: WorldData): ClientShareData {
  const h = world.history?.[c.id];
  return {
    clientId: c.id,
    firstName: c.name.split(' ')[0],
    mode: c.mode,
    consent: c.consent,
    workouts: workoutsOf(h?.workouts, c.gym),
    activities: ACTIVITIES[c.id] ?? [],
    results: resultsOf(h?.workouts?.exercises ?? []),
    weeklySets: weeklyOf(c.id),
    trainerDays: c.trainerDays,
  };
}

/** The share source for the fixture world. Every client is included; the resolver gates by the viewer. */
export function buildShareSource(world: WorldData = buildFixtureWorld()): ShareSource {
  return {
    now: FIXTURE_NOW,
    library: { exercises: catalogExercises(), equipment: catalogEquipment(), gyms: FIXTURE_GYMS },
    programs: FIXTURE_PROGRAMS,
    clients: Object.fromEntries(world.clients.map((c) => [c.id, clientData(c, world)])),
  };
}

export interface FixtureShareOptions {
  delayMs?: number;
  failWith?: () => boolean;
  warm?: boolean;
  /** Stories: change the source (lower a consent...). */
  patch?: (s: ShareSource) => ShareSource;
}
export function createFixturesShareSource(o: FixtureShareOptions = {}): ShareSourcePort {
  const build = () => (o.patch ? o.patch(buildShareSource()) : buildShareSource());
  let cached: ShareSource | null = o.warm ? build() : null;
  return {
    peek: () => cached,
    async load(_clientId, { signal }) {
      if (o.delayMs)
        await new Promise<void>((res, rej) => {
          const t = setTimeout(res, o.delayMs);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            rej(new Error('aborted'));
          });
        });
      if (o.failWith?.()) throw new Error('unavailable');
      cached = build();
      return cached;
    },
  };
}
