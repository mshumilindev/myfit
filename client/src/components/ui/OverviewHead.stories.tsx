import type { Meta, StoryObj } from '@storybook/react-vite';
import { OverviewHead } from './OverviewHead';

const meta = {
  title: 'Kit/OverviewHead',
  component: OverviewHead,
  args: { title: 'Goals' },
} satisfies Meta<typeof OverviewHead>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A long title wraps under the back button's row height, never clips. */
export const LongTitle: Story = {
  args: { title: 'A very long drill-in title that has to wrap on a narrow phone' },
};
