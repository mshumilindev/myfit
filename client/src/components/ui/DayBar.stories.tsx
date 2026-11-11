import type { Meta, StoryObj } from '@storybook/react-vite';
import { DayBar } from './DayBar';

const meta = {
  title: 'Kit/DayBar',
  component: DayBar,
  args: {
    ranges: [
      [360, 480],
      [1080, 1260],
    ],
    label: 'Free 06:00-08:00 and 18:00-21:00',
  },
} satisfies Meta<typeof DayBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Compact (in a row) and wide (under a page heading), plus an empty day. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16, maxWidth: 360 }}>
      <DayBar ranges={[[540, 780]]} />
      <DayBar
        wide
        ranges={[
          [360, 480],
          [1080, 1260],
        ]}
      />
      <DayBar ranges={[]} />
    </div>
  ),
};
