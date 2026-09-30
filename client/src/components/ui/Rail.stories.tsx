import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rail, RailItem } from './Rail';
import { Avatar } from './Avatar';

const meta = {
  title: 'Kit/Rail',
  component: Rail,
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  args: { brand: <Avatar name="S" size={40} />, children: null },
  decorators: [
    (Story) => (
      <div style={{ height: 720, display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Rail>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live() {
  const [tab, setTab] = useState('today');
  const items = [
    { id: 'today', icon: 'house', label: 'Today' },
    { id: 'overview', icon: 'chart-line-up', label: 'Overview' },
    { id: 'gyms', icon: 'map-pin', label: 'Gyms' },
  ];
  return (
    <Rail
      brand={<Avatar name="Spotter" size={40} />}
      foot={
        <>
          <RailItem icon="bell" ariaLabel="Alerts" badge="3" />
          <RailItem icon="squares-four" ariaLabel="Apps" className="rail-switch" />
          <RailItem icon="gear" label="Settings" />
        </>
      }
    >
      {items.map((x) => (
        <RailItem
          key={x.id}
          icon={x.icon}
          label={x.label}
          active={tab === x.id}
          fillWhenActive
          live={x.id === 'today'}
          onClick={() => setTab(x.id)}
        />
      ))}
    </Rail>
  );
}

/** The Gym rail: three tabs, a live dot on Today, a foot with badge + settings. */
export const Gym: Story = { render: () => <Live /> };
