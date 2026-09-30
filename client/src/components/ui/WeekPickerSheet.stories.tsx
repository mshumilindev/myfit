import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeekPickerSheet } from './WeekPickerSheet';

const bars = [
  { tone: 'ok' as const, level: 3 as const },
  { tone: 'danger' as const, level: 2 as const },
  { tone: 'illness' as const, level: 2 as const },
  { level: 1 as const },
  { tone: 'ok' as const, level: 3 as const },
  { tone: 'rest' as const, level: 2 as const },
  { tone: 'neutral' as const, level: 1 as const },
];
const weeks = Array.from({ length: 20 }, (_, i) => ({
  label: `Week ${i + 1}`,
  sub: i === 0 ? 'This week' : `${(i % 4) + 1} sessions`,
  bars,
}));

const meta = {
  title: 'Kit/WeekPickerSheet',
  component: WeekPickerSheet,
  args: {
    title: 'Pick a week',
    hint: 'Weeks start on the day you set in Settings',
    weeks,
    selected: 0,
    onPick: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof WeekPickerSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OlderSelected: Story = { args: { selected: 12 } };
