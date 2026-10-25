import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgramsView } from './ProgramsView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The Programs screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Programs',
  component: ProgramsView,
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
} satisfies Meta<typeof ProgramsView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { shell: storyShell } };
