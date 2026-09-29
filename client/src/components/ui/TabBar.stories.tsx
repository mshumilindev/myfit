import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './TabBar';

const meta = {
  title: 'Kit/TabBar',
  component: TabBar,
  parameters: { layout: 'fullscreen' },
  args: {
    items: [
      { id: 'today', label: 'Today', icon: 'house', active: true },
      { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
      { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
      { id: 'apps', label: 'Apps', icon: 'squares-four' },
    ],
    onSelect: () => undefined,
    fab: { ariaLabel: 'Start', onClick: () => undefined },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 390,
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Live() {
  const [tab, setTab] = useState('today');
  const items = [
    { id: 'today', label: 'Today', icon: 'house' },
    { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
    { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
  ].map((x) => ({ ...x, active: x.id === tab }));
  return (
    <TabBar
      items={items}
      onSelect={setTab}
      apps={{ label: 'Apps', ariaLabel: 'Apps', onClick: () => undefined }}
      fab={{ ariaLabel: 'Start', onClick: () => undefined }}
    />
  );
}

/** The app's real shape: three tabs + Apps + the Start FAB, interactive. */
export const App: Story = { render: () => <Live /> };
