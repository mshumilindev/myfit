import type { Meta, StoryObj } from '@storybook/react-vite';
import { MasteryView } from './MasteryView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The Mastery screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Mastery',
  component: MasteryView,
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
} satisfies Meta<typeof MasteryView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { shell: storyShell, onClose: () => undefined } };
