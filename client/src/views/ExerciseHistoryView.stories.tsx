import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExerciseHistoryView } from './ExerciseHistoryView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** Every logged set of one exercise, from the seeded sessions. */
const meta = {
  title: 'Pages/Exercise history',
  component: ExerciseHistoryView,
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
} satisfies Meta<typeof ExerciseHistoryView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { name: 'Barbell Bench Press', shell: storyShell, onClose: () => undefined },
};
