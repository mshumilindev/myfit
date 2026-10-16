import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionView } from './SessionView';
import { seedStore, storyShell, workoutOn } from '../stories/fixtures';
import { PageFrame } from '../stories/PageFrame';
import type { Workout } from '../types';

/**
 * Empty session start (SPO-113): one big hero card plus the 2x2 grid of small cards, each with the shared
 * exercise (i) button in the same corner. `scripts/story-audit.mjs` measures the button stays inside its card, clear
 * of the text, with a 44px touch area at 320/390 and every font scale and locale.
 */
const LONG_NAMES = [
  'Incline Dumbbell Bench Press',
  'Romanian Deadlift with Barbell',
  'Seated Cable Row with Neutral Grip',
  'Standing Overhead Barbell Shoulder Press',
  'Bulgarian Split Squat with Dumbbells',
];

function live(id: string): Workout {
  const w = workoutOn(id, 0);
  w.startedAt = Date.now() - 2 * 60_000;
  w.finishedAt = null;
  return w;
}

function past(id: string, daysAgo: number): Workout {
  const w = workoutOn(id, daysAgo);
  w.exercises = LONG_NAMES.map((name, i) => ({
    id: `${id}-ex${i}`,
    name,
    position: i,
    sets: [
      {
        id: `${id}-s${i}`,
        position: 0,
        reps: 8,
        weight: 40 + i * 5,
        isWarmup: false,
        loggedAt: w.startedAt,
      },
    ],
  }));
  return w;
}

const meta = {
  title: 'Pages/Session start',
  component: SessionView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { workoutId: 'session-start-story', shell: storyShell, onClose: () => undefined },
} satisfies Meta<typeof SessionView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Long exercise names from history: hero and four tiles, each with the (i) in the corner. */
export const LongNames: Story = {
  loaders: [
    () => {
      seedStore({
        workouts: [live('session-start-story'), past('start-h1', 2), past('start-h2', 5)],
      });
      return {};
    },
  ],
};

/** No history: the starter plan fills the hero (warm-up) and tiles. */
export const NoHistory: Story = {
  loaders: [
    () => {
      seedStore({ workouts: [live('session-start-story')] });
      return {};
    },
  ],
};
