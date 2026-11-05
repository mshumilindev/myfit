import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './ui/TabBar';
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

function DrawerWithFab() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <div className="screen" />
      <TabBar
        items={[
          { id: 'today', label: 'Today', icon: 'house', active: true },
          { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
          { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
        ]}
        onSelect={() => undefined}
        apps={{ label: 'Apps', ariaLabel: 'Apps', onClick: () => undefined }}
        fab={{
          ariaLabel: 'Start',
          closeLabel: 'Close',
          open,
          onClick: () => setOpen((v) => !v),
        }}
      />
      {open && <StartSheet shell={storyShell} inline={false} onClose={() => setOpen(false)} />}
    </>
  );
}

/** SPO-470: the drawer is up — the Start button has turned into a × above it and closes it; tap it to turn it back. */
export const DrawerOpenFab: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <DrawerWithFab />,
  loaders: [
    () => {
      seedStore({ workouts: [workoutOn('start-sheet-past', 3)] });
      return {};
    },
  ],
};
