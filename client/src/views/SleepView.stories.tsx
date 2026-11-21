import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { addonsPref } from '../addons/enabledSet';
import { SleepView } from './SleepView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';
import { __getStateForTests, __replaceStateForTests } from '../store';

/** The Sleep overlay only ever shows while the app is in night mode (App.tsx sets `data-sleep`). */
function NightFrame({ children, night = true }: { children: React.ReactNode; night?: boolean }) {
  useEffect(() => {
    if (!night) return undefined;
    const el = document.documentElement;
    el.dataset.sleep = 'night';
    return () => {
      delete el.dataset.sleep;
    };
  }, [night]);
  return <PageFrame>{children}</PageFrame>;
}

/** SPO-550/551: 14 finished nights (6h30..8h30, a late weekend) so the hub shows both bar charts. */
function seedHistory(): void {
  addonsPref.set(['sleep', 'activities']); // the Sleep add-on must be installed or its nights are masked (SPO-500)
  seedPage();
  const hours = [7.5, 8.5, 6.5, 7, 8, 8.25, 6.75, 9, 7.25, 8, 6.5, 8.5, 7.75, 8.25];
  const sleeps = hours.map((h, i) => {
    const wake = new Date();
    wake.setHours(7, 0, 0, 0);
    wake.setDate(wake.getDate() - i);
    const wakeMs = wake.getTime();
    return {
      id: `story-hist-${i}`,
      date: 'story',
      bedtime: wakeMs - h * 3600_000,
      wake: wakeMs,
      source: 'live' as const,
    };
  });
  __replaceStateForTests({ ...__getStateForTests(), sleeps });
}

/** The Sleep screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Sleep',
  component: SleepView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, context) => (
      <NightFrame night={context.parameters.sleepNight !== false}>
        <Story />
      </NightFrame>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      return {};
    },
  ],
} satisfies Meta<typeof SleepView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onClose: () => undefined } };

/** SPO-472: the "Sleep logged" screen; the quality row must sit on the screen's centre axis. */
export const Logged: Story = {
  args: { onClose: () => undefined, mode: 'logged' },
  loaders: [
    () => {
      seedPage();
      const wake = new Date();
      wake.setTime(Date.now() - 3600_000);
      __replaceStateForTests({
        ...__getStateForTests(),
        sleeps: [
          {
            id: 'story-night',
            date: 'story',
            bedtime: wake.getTime() - 7.5 * 3600_000,
            wake: wake.getTime(),
            source: 'live',
          },
        ],
      });
      return {};
    },
  ],
};

/** SPO-550/551: the hub with a full history (bars, goal line, weekday rhythm), night mode as in the app. */
export const WithHistory: Story = {
  args: { onClose: () => undefined },
  loaders: [
    async () => {
      // The Sleep runtime (`sleepBoot`) is a lazy chunk (SPO-500 I8): without it every stat is empty. Loading it also runs after the
      // page-level `seedPage` loader, which would otherwise wipe the nights.
      await import('../sleepBoot');
      seedHistory();
      return {};
    },
  ],
};

/** SPO-550/551: the same hub on the day theme (no `data-sleep`), to check bars follow the theme accent. */
export const WithHistoryDay: Story = {
  args: { onClose: () => undefined },
  parameters: { sleepNight: false },
  loaders: WithHistory.loaders,
};
