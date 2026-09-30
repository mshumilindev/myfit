import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeekBars } from './WeekBars';

const meta = {
  title: 'Kit/WeekBars',
  component: WeekBars,
  args: { days: [] },
} satisfies Meta<typeof WeekBars>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Trained (green) wins; missed, rest, unwell, injury, active rest and logged-only have their family. */
export const AllStates: Story = {
  args: {
    days: [
      { tone: 'ok', level: 3 },
      { tone: 'danger', level: 2 },
      { tone: 'rest', level: 2 },
      { tone: 'illness', level: 2 },
      { tone: 'injury', level: 2 },
      { tone: 'active', level: 2 },
      { tone: 'neutral', level: 1 },
    ],
  },
};
export const Empty: Story = {
  args: { days: Array.from({ length: 7 }, () => ({ level: 1 as const })) },
};
