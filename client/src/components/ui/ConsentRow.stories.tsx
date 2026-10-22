import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsentRow } from './ConsentRow';
import { GroupedList } from './GroupedList';

const meta = {
  title: 'Kit/ConsentRow',
  component: ConsentRow,
  args: {
    icon: 'heartbeat',
    label: 'Cycle tracking',
    sub: 'Period dates and symptoms you log',
    status: 'Given · 1.2',
    on: true,
    onChange: () => undefined,
  },
} satisfies Meta<typeof ConsentRow>;
export default meta;
type Story = StoryObj<typeof meta>;

function List() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <GroupedList surface="raised" label="Consents">
      <ConsentRow
        icon="heartbeat"
        label="Cycle tracking"
        sub="Period dates and symptoms you log"
        status={a ? 'Given · 1.2' : 'Not given'}
        on={a}
        onChange={setA}
      />
      <ConsentRow
        icon="sparkle"
        tone="atlas"
        label="Atlas AI"
        sub="Questions are sent to the model provider"
        status={b ? 'Given · 1.0' : 'Not given'}
        on={b}
        onChange={setB}
      />
      <ConsentRow
        icon="map-pin"
        label="Gym search"
        sub="Your area is sent to map services"
        status="Given · 1.0"
        on
        disabled
        onChange={() => undefined}
      />
      <ConsentRow
        icon="first-aid"
        label="Injuries and conditions, a deliberately long consent name that must wrap"
        sub="A long explanation of what this covers, who sees it and why, which has to wrap onto several lines without clipping."
        status="Not given"
        on={false}
        onChange={() => undefined}
      />
    </GroupedList>
  );
}

export const Given: Story = {};
export const NotGiven: Story = { args: { on: false, status: 'Not given' } };
export const Disabled: Story = { args: { disabled: true } };
export const InList: Story = { render: () => <List /> };
