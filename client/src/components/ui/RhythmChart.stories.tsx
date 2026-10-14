import type { Meta, StoryObj } from '@storybook/react-vite';
import { RhythmChart, type RhythmBar } from './RhythmChart';

const bar = (label: string, value: number, current = false): RhythmBar => ({
  label,
  value,
  current,
  ariaLabel: `${label}: ${value} sessions`,
});

const meta = {
  title: 'Coach/RhythmChart',
  component: RhythmChart,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Sessions per week, last 7 weeks and this week',
    plan: 4,
    legendDone: 'Sessions done',
    legendPlan: 'Dashed line is the plan, 4 a week',
    bars: [
      bar('W-7', 4),
      bar('W-6', 4),
      bar('W-5', 4),
      bar('W-4', 4),
      bar('W-3', 4),
      bar('W-2', 4),
      bar('W-1', 4),
      bar('Now', 1, true),
    ],
  },
} satisfies Meta<typeof RhythmChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnPlan: Story = {};
export const Slipping: Story = {
  args: {
    bars: [
      bar('W-7', 4),
      bar('W-6', 4),
      bar('W-5', 3),
      bar('W-4', 3),
      bar('W-3', 2),
      bar('W-2', 1),
      bar('W-1', 0),
      bar('Now', 0, true),
    ],
  },
};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340 }}>
        <Story />
      </div>
    ),
  ],
};
