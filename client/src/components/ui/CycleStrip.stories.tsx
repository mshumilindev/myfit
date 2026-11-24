import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CycleStrip, type CycleStripWeek } from './CycleStrip';

const WEEKS: CycleStripWeek[] = [
  { n: 1, title: 'Week 1', tag: 'Base' },
  { n: 2, title: 'Week 2', tag: 'Normal' },
  { n: 3, title: 'Week 3', tag: 'Peak', tone: 'illness' },
  { n: 4, title: 'Week 4', tag: 'Deload', tone: 'rest' },
];

const meta = {
  title: 'Kit/CycleStrip',
  component: CycleStrip,
  args: { weeks: WEEKS, value: 1, label: 'Cycle weeks' },
} satisfies Meta<typeof CycleStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Live({ weeks }: { weeks: CycleStripWeek[] }) {
  const [n, setN] = useState(1);
  return <CycleStrip weeks={weeks} value={n} onPick={setN} label="Cycle weeks" />;
}

/** Pick a week; the picked one is ringed. */
export const Interactive: Story = { render: () => <Live weeks={WEEKS} /> };

/** Twelve weeks: the strip scrolls sideways instead of wrapping. */
export const Long: Story = {
  render: () => (
    <Live
      weeks={Array.from({ length: 12 }, (_, i) => ({
        n: i + 1,
        title: `Week ${i + 1}`,
        tag: i === 11 ? 'Test' : i % 4 === 3 ? 'Deload' : 'Normal',
        tone: i === 11 ? 'accent' : i % 4 === 3 ? 'rest' : 'neutral',
      }))}
    />
  ),
};
