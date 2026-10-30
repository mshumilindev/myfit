import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart, type BarChartBar, type BarTone } from './BarChart';
import { Card } from './Card';

const tones: BarTone[] = [
  'muted',
  'muted',
  'muted',
  'muted',
  'muted',
  'accent-800',
  'accent-700',
  'accent-700',
  'accent-600',
  'accent',
];
const weeks = [3200, 0, 5400, 6100, 0, 7200, 8800, 9400, 10100, 6000];
const toBars = (kg: number[]): BarChartBar[] =>
  kg.map((v, i) => ({
    label: `${i * 7 + 1}–${i * 7 + 7} Oct`,
    valueText: v > 0 ? `${(v / 1000).toFixed(1)} t` : 'No workouts',
    value: v,
    tone: tones[i % tones.length],
  }));

const meta = {
  title: 'Kit/BarChart',
  component: BarChart,
  args: { bars: toBars(weeks), label: 'Volume this week' },
  decorators: [
    (Story) => (
      <Card emphasis="hero">
        <Story />
      </Card>
    ),
  ],
} satisfies Meta<typeof BarChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** Newest bar is the tallest: the tip flips beside it instead of leaving the chart. */
export const TallLast: Story = {
  args: { bars: toBars([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 20000]) },
};
export const Empty: Story = { args: { bars: toBars(Array.from({ length: 10 }, () => 0)) } };
export const ThirteenWeeks: Story = {
  args: { bars: toBars([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => n * 700)) },
};
export const Single: Story = { args: { bars: toBars([6000]) } };
