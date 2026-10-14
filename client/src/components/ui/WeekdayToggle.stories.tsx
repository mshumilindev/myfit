import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { WeekdayToggle, type WeekdayToggleDay } from './WeekdayToggle';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const day = (id: string, on: boolean, rest = false): WeekdayToggleDay => ({
  id,
  label: id,
  sub: rest ? 'Rest' : on ? 'With Iryna' : 'Solo',
  on,
  disabled: rest,
  ariaLabel: `${id}, ${rest ? 'rest day' : on ? 'with Iryna' : 'solo'}`,
});
const DAYS = WEEK.map((d) =>
  day(d, d === 'Mon' || d === 'Thu', d === 'Wed' || d === 'Sat' || d === 'Sun'),
);

const meta = {
  title: 'Coach/Weekday toggle',
  component: WeekdayToggle,
  args: { days: DAYS, label: 'Days with Iryna', onToggle: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 640, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeekdayToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Editable(a: React.ComponentProps<typeof WeekdayToggle>) {
  const [on, setOn] = useState(new Set(['Mon', 'Thu']));
  return (
    <WeekdayToggle
      {...a}
      days={WEEK.map((d) => day(d, on.has(d), d === 'Wed' || d === 'Sat' || d === 'Sun'))}
      onToggle={(id) =>
        setOn((s) => {
          const n = new Set(s);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        })
      }
    />
  );
}
/** The editor: a trainer toggles days; rest days cannot be chosen. */
export const Interactive: Story = { render: (a) => <Editable {...a} /> };

/** What a client sees: the same tiles, read only. */
export const ReadOnly: Story = { args: { readOnly: true } };

export const Phone: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
};
