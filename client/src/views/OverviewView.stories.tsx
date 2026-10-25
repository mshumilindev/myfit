import type { Meta, StoryObj } from '@storybook/react-vite';
import { OverviewView } from './OverviewView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The Overview screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Overview',
  component: OverviewView,
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
} satisfies Meta<typeof OverviewView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    shell: storyShell,
    onProgress: () => undefined,
    onTrends: () => undefined,
    onActivity: () => undefined,
    onPrograms: () => undefined,
  },
};
