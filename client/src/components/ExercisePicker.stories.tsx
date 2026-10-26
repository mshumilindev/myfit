import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExercisePicker } from './ExercisePicker';
import { PageFrame } from '../stories/PageFrame';
import { seedStore, workoutOn } from '../stories/fixtures';
import type { Gym, Workout } from '../types';

/** SPO-352: bench flat for 4 sessions, the last 9 days ago, nothing since. */
function restedStalled(): Workout[] {
  return [9, 12, 15, 18].map((d) => {
    const w = workoutOn(`picker-rested-${d}`, d);
    w.exercises = [
      {
        id: `bench-${d}`,
        name: 'Barbell Bench Press - Medium Grip',
        position: 0,
        sets: Array.from({ length: 3 }, (_, i) => ({
          id: `bs-${d}-${i}`,
          reps: 8,
          weight: 60,
          isWarmup: false,
          position: i,
          loggedAt: w.startedAt,
        })),
      },
    ];
    return w;
  });
}

const gym: Gym = { id: 'g1', name: 'Home gym', lat: 0, lng: 0, radiusM: 100 };

function session(): Workout {
  const w = workoutOn('picker-story', 0);
  w.finishedAt = null;
  return w;
}

const meta = {
  title: 'Pages/ExercisePicker',
  component: ExercisePicker,
  parameters: { layout: 'fullscreen' },
  loaders: [
    () => {
      seedStore({ workouts: [session(), workoutOn('picker-prev', 3)] });
      return {};
    },
  ],
  render: (args) => (
    <PageFrame>
      <ExercisePicker {...args} />
    </PageFrame>
  ),
  args: {
    workout: session(),
    gym,
    onPick: () => {},
    onClose: () => {},
    onMarker: () => {},
    onCardio: () => {},
    onCreate: () => {},
  },
} satisfies Meta<typeof ExercisePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Home: search, day suggestions and muscle-family tiles (desktop: rail · grid · preview). */
export const Browse: Story = {};
/** Swapping an exercise in place. */
export const Replacing: Story = { args: { replacing: true } };
/** Program authoring: no recommendations. */
export const Plain: Story = {
  args: { plain: true, subtitle: 'Mon · Upper A', added: ['Bench Press'], addLabel: 'Add' },
};
/** Warm-up block picker. */
export const Warmup: Story = { args: { warmup: true } };
/** SPO-352: a flat lift with no sets for 9 days reads Fresh (with the reason), not High. */
export const RestedStalledLift: Story = {
  loaders: [
    () => {
      seedStore({ workouts: [session(), ...restedStalled()] });
      return {};
    },
  ],
};
