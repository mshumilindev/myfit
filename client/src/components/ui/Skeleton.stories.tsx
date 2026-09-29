import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton, SkeletonRows } from './Skeleton';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Skeleton',
  component: SkeletonRows,
  args: { rows: 3, label: 'Loading' },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SkeletonRows>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {};

/** Loose blocks: a heading, a card, a round tile. */
export const Blocks: Story = {
  render: () => (
    <Stack>
      <Skeleton width={120} height={10} />
      <Skeleton width={210} height={26} />
      <Skeleton height={92} />
      <Skeleton width={48} height={48} round />
    </Stack>
  ),
};
