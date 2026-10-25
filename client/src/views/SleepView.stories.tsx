import type { Meta, StoryObj } from '@storybook/react-vite';
import { SleepView } from './SleepView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

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
