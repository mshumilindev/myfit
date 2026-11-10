import type { Meta, StoryObj } from '@storybook/react-vite';
import { SleepView } from './SleepView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';
import { __getStateForTests, __replaceStateForTests } from '../store';

/** The Sleep screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Sleep',
  component: SleepView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
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
