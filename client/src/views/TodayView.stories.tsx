import type { Meta, StoryObj } from '@storybook/react-vite';
import { TodayView } from './TodayView';
import { useStore } from '../store';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';
import { ThemePreviewHost } from '../components/ThemeAnnouncement';
import { resetSeenForTest, syncSeenFromDoc } from '../themes/seen';

function TodayViewStory() {
  const store = useStore();
  return <TodayView shell={storyShell} store={store} />;
}

/** The Today screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Today',
  component: TodayViewStory,
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
} satisfies Meta<typeof TodayViewStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A new theme is out and this account has not seen it (SPO-355): the invite sits under the day heading, drawn in the new theme; Preview puts the whole app and the dock in it. */
export const NewThemeInvite: Story = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <ThemePreviewHost />
      </>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      resetSeenForTest();
      syncSeenFromDoc({}, () => undefined);
      return {};
    },
  ],
};
