import { BUILT_IN_CATALOG, type MuscleGroup } from '../data/exercises';

export type BlockGroup =
  'bodyweight' | 'kettlebell' | 'dumbbell' | 'barbell' | 'machines' | 'throws';
export const BLOCK_GROUPS: readonly BlockGroup[] = [
  'bodyweight',
  'kettlebell',
  'dumbbell',
  'barbell',
  'machines',
  'throws',
];

const BODYWEIGHT = [
  'Burpee',
  'Toes To Bar',
  'Pullups',
  'Chin-Up',
  'Pushups',
  'Push-Ups With Feet Elevated',
  'Single-Arm Push-Up',
  'Plyo Push-up',
  'Handstand Push-Ups',
  'Dips - Triceps Version',
  'Bench Dips',
  'Bodyweight Squat',
  'Freehand Jump Squat',
  'Step-up with Knee Raise',
  'Mountain Climbers',
  'Sit-Up',
  'Jackknife Sit-Up',
  'Russian Twist',
  'Flutter Kicks',
  'Hanging Pike',
  'Star Jump',
  'Split Jump',
  'Scissors Jump',
  'Knee Tuck Jump',
  'Rocket Jump',
  'Front Box Jump',
  'Box Jump (Multiple Response)',
  'Lateral Box Jump',
  'Standing Long Jump',
  'Hurdle Hops',
  'Wind Sprints',
];
const KETTLEBELL = [
  'One-Arm Kettlebell Swings',
  'Kettlebell Thruster',
  'Goblet Squat',
  'Front Squats With Two Kettlebells',
  'One-Arm Kettlebell Snatch',
  'Double Kettlebell Snatch',
  'One-Arm Kettlebell Clean',
  'Two-Arm Kettlebell Clean',
  'Kettlebell Hang Clean',
  'Alternating Hang Clean',
  'Kettlebell Sumo High Pull',
  'One-Arm Kettlebell Push Press',
  'Double Kettlebell Push Press',
  'Kettlebell Figure 8',
  'Lunge Pass Through',
  'Alternating Kettlebell Row',
  'Two-Arm Kettlebell Row',
  'Alternating Renegade Row',
  'Kettlebell One-Legged Deadlift',
  'Plyo Kettlebell Pushups',
];
const DUMBBELL = ['Dumbbell Clean', 'Dumbbell Squat', 'Dumbbell Step Ups', 'Dumbbell Rear Lunge'];
const BARBELL = [
  'Clean and Press',
  'Clean and Jerk',
  'Clean',
  'Hang Clean',
  'Power Clean from Blocks',
  'Snatch',
  'Power Snatch',
  'Push Press',
  'Overhead Squat',
  'Barbell Deadlift',
  'Front Barbell Squat',
  'Barbell Squat',
  'Barbell Walking Lunge',
  'Barbell Lunge',
];
const MACHINES = [
  'Air Bike',
  'Rope Jumping',
  'Rowing, Stationary',
  'Running, Treadmill',
  'Jogging, Treadmill',
  'Bicycling, Stationary',
  'Stairmaster',
  'Step Mill',
  'Elliptical Trainer',
  'Prowler Sprint',
];
const THROWS = [
  'Wall Ball',
  'Overhead Slam',
  'One-Arm Medicine Ball Slam',
  'Medicine Ball Chest Pass',
  'Medicine Ball Scoop Throw',
  'Sledgehammer Swings',
  'Sled Push',
  'Sled Drag - Harness',
  "Farmer's Walk",
  'Tire Flip',
  'Bear Crawl Sled Drags',
  'Sandbag Load',
];

/** Moves that work in a timed block (the catalogue's own names), by the way they are done. Heavy singles, isolation and stretches stay out; others can be added by name. */
const READY: ReadonlyArray<readonly [string, BlockGroup]> = [
  ...BODYWEIGHT.map((n) => [n, 'bodyweight'] as const),
  ...KETTLEBELL.map((n) => [n, 'kettlebell'] as const),
  ...DUMBBELL.map((n) => [n, 'dumbbell'] as const),
  ...BARBELL.map((n) => [n, 'barbell'] as const),
  ...MACHINES.map((n) => [n, 'machines'] as const),
  ...THROWS.map((n) => [n, 'throws'] as const),
];

export interface BlockReadyItem {
  name: string;
  group: BlockGroup;
  muscle: MuscleGroup | null;
}

/** The block-ready list, only the names this catalogue really has. */
export function blockReadyList(): BlockReadyItem[] {
  const byName = new Map(BUILT_IN_CATALOG.map((e) => [e.names[0].toLowerCase(), e]));
  return READY.flatMap(([name, group]) => {
    const e = byName.get(name.toLowerCase());
    return e ? [{ name: e.names[0], group, muscle: e.muscle }] : [];
  });
}
