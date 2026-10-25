import type { Meta, StoryObj } from '@storybook/react-vite';
import { GymsView } from './GymsView';
import { useStore } from '../store';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

function GymsViewStory() {
  const store = useStore();
  return <GymsView shell={storyShell} store={store} />;
}

/** The Gyms screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Gyms',
  component: GymsViewStory,
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
} satisfies Meta<typeof GymsViewStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
