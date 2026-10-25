import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChallengesView } from './ChallengesView';
import { useStore } from '../store';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

function ChallengesViewStory() {
  const store = useStore();
  return <ChallengesView store={store} />;
}

/** The Challenges screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Challenges',
  component: ChallengesViewStory,
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
} satisfies Meta<typeof ChallengesViewStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
