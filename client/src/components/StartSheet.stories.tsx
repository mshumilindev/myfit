import type { Meta, StoryObj } from '@storybook/react-vite';
import { StartSheet } from './StartSheet';
import { atDay, seedStore, storyShell, workoutOn } from '../stories/fixtures';
import { PageFrame } from '../stories/PageFrame';
import type { Workout } from '../types';

/**
 * Start sheet (SPO-5). Trained today: the hero reports the day as done with a 60px ring and a centred check, plus
 * the "another workout" row. Not trained today: the ordinary arrow hero and start tiles, no ring.
 */
const meta = {
  title: 'Pages/Start sheet',
  component: StartSheet,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { shell: storyShell, onClose: () => undefined, inline: true },
} satisfies Meta<typeof StartSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

function trainedToday(): Workout {
  const w = workoutOn('start-sheet-today', 0);
  w.startedAt = atDay(0, 0, 1);
  w.finishedAt = atDay(0, 0, 51);
  w.exercises = [
    {
      id: 'ss-ex',
      name: 'Barbell Bench Press',
      position: 0,
      sets: [
        { id: 'ss-s', position: 0, reps: 8, weight: 60, isWarmup: false, loggedAt: w.startedAt },
      ],
    },
  ];
  return w;
}

/** Trained today: check ring in the hero, "another workout" below. */
export const DoneToday: Story = {
  loaders: [
    () => {
      seedStore({ workouts: [trainedToday()] });
      return {};
    },
  ],
};

/** Not trained today: arrow hero, no ring. */
export const NotToday: Story = {
  loaders: [
    () => {
      seedStore({ workouts: [workoutOn('start-sheet-past', 3)] });
      return {};
    },
  ],
};
