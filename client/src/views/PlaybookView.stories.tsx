import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaybookView } from './PlaybookView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The Playbook screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Playbook',
  component: PlaybookView,
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
} satisfies Meta<typeof PlaybookView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { shell: storyShell } };
