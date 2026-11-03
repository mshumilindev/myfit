import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallSessionChip } from './CallSessionChip';

const meta = {
  title: 'Kit/CallSessionChip',
  component: CallSessionChip,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Barbell Bench Press',
    detail: 'Set 2/4 · rest',
    time: '1:32',
    openLabel: 'Back to your workout',
    onOpen: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358, margin: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallSessionChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {};
export const NoRestRunning: Story = { args: { detail: 'Set 3/4', time: '24:10' } };
export const LongTitle: Story = {
  args: { title: 'Dumbbell Romanian Deadlift with a Very Long Exercise Name' },
};
