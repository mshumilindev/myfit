import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExercisePicker } from './ExercisePicker';
import { PageFrame } from '../stories/PageFrame';
import { seedStore, workoutOn } from '../stories/fixtures';
import type { Gym, Workout } from '../types';

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
