import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExerciseLibraryView } from './ExerciseLibraryView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** The Exercise library screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Exercise library',
  component: ExerciseLibraryView,
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
} satisfies Meta<typeof ExerciseLibraryView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { shell: storyShell, libTab: 'library', onLibTab: () => undefined },
};
