import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarmupCard } from './WarmupCard';
import { seedStore, workoutOn } from '../stories/fixtures';
import { useStore } from '../store';

function Preview() {
  const { workouts } = useStore();
  const workout = workouts.find((w) => w.id === 'warmup-story');
  if (!workout) return null;
  return <WarmupCard workout={workout} exercise={workout.exercises[0]} />;
}

const meta = {
  title: 'Pages/Warmup',
  component: Preview,
  loaders: [
    ({ parameters }) => {
      const workout = workoutOn('warmup-story', 0);
      workout.finishedAt = null;
      workout.exercises = [
        {
          id: 'warmup-marker',
          name: 'Warm-up',
          position: 0,
          kind: 'warmup',
          sets: [],
          plannedDurationMin: parameters.withExercises === true ? null : 5,
          ...(parameters.withExercises === true
            ? {
                warmupItems: [
                  {
                    id: 'pull-apart',
                    name: 'Band Pull Apart',
                    exerciseId: 'Band_Pull_Apart',
                    reps: 15,
                    done: true,
                  },
                  {
                    id: 'curl',
                    name: 'Dumbbell Bicep Curl',
                    reps: 12,
                    weight: 7.5,
                    done: false,
                  },
                  {
                    id: 'raise',
                    name: 'Lateral Raise - With Bands',
                    exerciseId: 'Lateral_Raise_-_With_Bands',
                    reps: 15,
                    done: false,
                  },
                ],
              }
            : {}),
        },
      ];
      seedStore({ workouts: [workout] });
      return {};
    },
  ],
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No exercises: a plain, generic warm-up with optional minutes. */
export const Generic: Story = {};
/** Exercises from the library: pending loggers (Log) and one-line logged rows (Edit). */
export const WithExercises: Story = { parameters: { withExercises: true } };
