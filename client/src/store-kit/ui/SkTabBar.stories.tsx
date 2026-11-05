import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SkStage } from '../stories/SkStage';
import { SkTabBar, type SkTab } from './SkTabBar';

const icon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <rect x="4" y="4" width="16" height="16" rx="4" />
  </svg>
);
const tabs = (dot: boolean): SkTab[] => [
  { id: 'discover', label: 'Discover', icon },
  { id: 'apps', label: 'Apps', icon },
  { id: 'addons', label: 'Add-ons', icon },
  { id: 'selected', label: 'Selected', icon, dot, dotLabel: 'has items' },
  { id: 'installed', label: 'Installed', icon },
];

const meta = {
  title: 'Store/SkTabBar',
  component: SkTabBar,
  args: { tabs: tabs(false), active: 'discover', onSelect: () => {}, label: 'Store sections' },
} satisfies Meta<typeof SkTabBar>;
export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({ dot }: { dot: boolean }) {
  const [active, setActive] = useState<string | null>('discover');
  return <SkTabBar tabs={tabs(dot)} active={active} onSelect={setActive} label="Store sections" />;
}

export const Default: Story = {
  render: () => (
    <SkStage width="phone">
      <Interactive dot={false} />
    </SkStage>
  ),
};

/** Dot on Selected; and no active tab (item page / search). */
export const WithDotAndNoActive: Story = {
  render: (args) => (
    <SkStage width="phone">
      <Interactive dot />
      <SkTabBar {...args} tabs={tabs(true)} active={null} />
    </SkStage>
  ),
};
