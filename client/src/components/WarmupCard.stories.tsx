import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarmupCard } from './WarmupCard';
import { seedStore, workoutOn } from '../stories/fixtures';
import { useStore } from '../store';

function Preview() {
  const { workouts } = useStore();
  const workout = workouts.find((w) => w.id === 'warmup-story');
  if (!workout) return null;
  return (
    <WarmupCard
      workout={workout}
      exercise={workout.exercises[0]}
      muscles={['chest', 'shoulders']}
    />
  );
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
          warmupDetailed: parameters.detailed === true,
          plannedDurationMin: 5,
          warmupItems: [
            { id: 'walk', name: 'Walking', durationSec: 180, done: true },
            { id: 'circles', name: 'Arm circles', reps: 10, done: false },
          ],
        },
      ];
      seedStore({ workouts: [workout] });
      return {};
    },
  ],
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};
export const Detailed: Story = { parameters: { detailed: true } };
