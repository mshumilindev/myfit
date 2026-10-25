import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActivityView } from './ActivityView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** Starting a new activity (run). */
const meta = {
  title: 'Pages/Activity',
  component: ActivityView,
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
} satisfies Meta<typeof ActivityView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { newType: 'run', onClose: () => undefined } };
