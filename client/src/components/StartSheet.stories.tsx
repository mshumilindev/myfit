import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './ui/TabBar';
import { addonsPref } from '../addons/enabledSet';
import { StartSheet } from './StartSheet';
import { atDay, seedStore, storyShell, workoutOn } from '../stories/fixtures';
import { PageFrame } from '../stories/PageFrame';
import { StartFab } from '../stories/StartFab';
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
    // The × above the open drawer is part of every picture of it (stories/StartFab.tsx, StartSheet.fab.test.tsx).
    (Story, ctx) => (
      <PageFrame>
        <Story />
        {ctx.args.inline ? <StartFab /> : null}
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

function DrawerWithFab({ late = false }: { late?: boolean }) {
  const [open, setOpen] = useState(true);
  // the app lazy-loads the Start drawer, so it lands in <body> AFTER the button: `late` reproduces that order
  const [ready, setReady] = useState(!late);
  useEffect(() => {
    if (!late) return;
    const id = window.setTimeout(() => setReady(true), 400);
    return () => window.clearTimeout(id);
  }, [late]);
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
      {open && ready && (
        <StartSheet shell={storyShell} inline={false} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** A workout is running: the other starters are locked; the lock sits at the far end of the tile that runs across both columns. */
export const LockedWhileLive: Story = {
  loaders: [
    () => {
      const live = trainedToday();
      live.id = 'start-sheet-live';
      live.finishedAt = null;
      addonsPref.set(['activities', 'home-sets']);
      seedStore({ workouts: [workoutOn('start-sheet-past', 3), live] });
      return {};
    },
  ],
};

/** SPO-470: the drawer is up — the Start button has turned into a × above it and closes it; tap it to turn it back. */
export const DrawerOpenFab: Story = {
  args: { inline: false },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <DrawerWithFab />,
  loaders: [
    () => {
      seedStore({ workouts: [workoutOn('start-sheet-past', 3)] });
      return {};
    },
  ],
};

/** Same, with the Start drawer arriving after the button (the app's lazy chunk): the × must still be above it. */
export const DrawerOpenFabLateDrawer: Story = {
  args: { inline: false },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <DrawerWithFab late />,
  loaders: [
    () => {
      seedStore({ workouts: [workoutOn('start-sheet-past', 3)] });
      return {};
    },
  ],
};
