import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkTray } from './SkTray';

const meta = {
  title: 'Store/SkTray',
  component: SkTray,
  args: { label: '3 selected', actionLabel: 'Review', onAction: () => {} },
} satisfies Meta<typeof SkTray>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Phone: full width. */
export const Phone: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkTray {...args} />
      <SkTray {...args} label="1 selected" />
    </SkStage>
  ),
};

/** Long label must truncate, never push the action out. Desktop placement: see Store/SkShell. */
export const LongLabel: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkTray {...args} label="12 add-ons selected for installation on this device" />
    </SkStage>
  ),
};
