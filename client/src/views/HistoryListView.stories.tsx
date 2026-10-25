import type { Meta, StoryObj } from '@storybook/react-vite';
import { HistoryListView } from './HistoryListView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The History screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/History',
  component: HistoryListView,
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
} satisfies Meta<typeof HistoryListView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { shell: storyShell, onClose: () => undefined } };
