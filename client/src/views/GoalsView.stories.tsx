import type { Meta, StoryObj } from '@storybook/react-vite';
import { GoalsView } from './GoalsView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** The Goals screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Goals',
  component: GoalsView,
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
} satisfies Meta<typeof GoalsView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
