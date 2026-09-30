import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfileSkeleton, RowListSkeleton, ScreenSkeleton } from './Skeletons';

const meta = {
  title: 'Kit/Skeletons',
  component: ScreenSkeleton,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ScreenSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Today-shaped placeholder shown while the first sync runs. */
export const Screen: Story = {};
export const RowList: Story = { render: () => <RowListSkeleton rows={4} /> };
export const RowListCompact: Story = {
  render: () => <RowListSkeleton rows={3} withMeta={false} />,
};
export const Profile: Story = { render: () => <ProfileSkeleton /> };
