import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RepRange, type RepRangeLabels } from './RepRange';

const LABELS: RepRangeLabels = {
  reps: 'Reps',
  from: 'From',
  to: 'To',
  useRange: 'Use a range',
  useOne: 'Use one number',
};

const meta = {
  title: 'Kit/RepRange',
  component: RepRange,
  args: { reps: 8, onChange: () => undefined, labels: LABELS },
} satisfies Meta<typeof RepRange>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One number. */
export const One: Story = {};

/** From – to. */
export const Range: Story = { args: { reps: 8, repsMin: 6 } };

function Live() {
  const [v, setV] = useState<{ reps: number; repsMin?: number }>({ reps: 8 });
  return <RepRange reps={v.reps} repsMin={v.repsMin} onChange={setV} labels={LABELS} />;
}
export const Interactive: Story = { render: () => <Live /> };
