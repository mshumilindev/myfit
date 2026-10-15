import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionView } from './SessionView';
import { seedStore, storyShell, workoutOn } from '../stories/fixtures';
import { PageFrame } from '../stories/PageFrame';

/**
 * The active session in focus mode (SPO-11): the set-entry panel with its Log button and accent glow, the step line
 * above and the pinned nav below. `scripts/story-audit.mjs` (`shadow-clipped`) measures that no ancestor with overflow
 * saws off the panel's shadow. The glow reaches ~60px down / ~38px sideways, so the scroll area must leave that room
 * above the opaque nav.
 */
const meta = {
  title: 'Pages/Session focus',
  component: SessionView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { workoutId: 'session-focus-story', shell: storyShell, onClose: () => undefined },
  loaders: [
    () => {
      const workout = workoutOn('session-focus-story', 0);
      workout.startedAt = Date.now() - 25 * 60_000;
      workout.finishedAt = null;
      workout.exercises = [
        {
          id: 'ex-bench',
          name: 'Barbell Bench Press',
          position: 0,
          sets: [
            {
              id: 's1',
              position: 0,
              reps: 8,
              weight: 60,
              isWarmup: false,
              loggedAt: Date.now() - 4 * 60_000,
            },
          ],
        },
        { id: 'ex-row', name: 'Barbell Row', position: 1, sets: [] },
      ];
      seedStore({ workouts: [workout] });
      return {};
    },
  ],
} satisfies Meta<typeof SessionView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Set-entry panel with Log, between the step line and the nav. */
export const SetEntry: Story = {};
