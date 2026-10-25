import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExerciseDetailView } from './ExerciseDetailView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** One exercise: muscles, photos and the history the seeded sessions give it. */
const meta = {
  title: 'Pages/Exercise detail',
  component: ExerciseDetailView,
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
} satisfies Meta<typeof ExerciseDetailView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { name: 'Barbell Bench Press', shell: storyShell, onClose: () => undefined },
};
