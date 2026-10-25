import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionBuilderView } from './SessionBuilderView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The Session builder screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Session builder',
  component: SessionBuilderView,
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
} satisfies Meta<typeof SessionBuilderView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { shell: storyShell, programMode: 'none', programDays: [], onClose: () => undefined },
};
