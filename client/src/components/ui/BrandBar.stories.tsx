import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandBar, BellButton } from './BrandBar';

const meta = {
  title: 'Kit/BrandBar',
  component: BrandBar,
  args: { app: 'Gym', appLabel: 'Switch app', onApp: () => undefined },
} satisfies Meta<typeof BrandBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { actions: <BellButton label="Notifications" onClick={() => undefined} /> },
};

export const Unread: Story = {
  args: { actions: <BellButton label="Notifications" onClick={() => undefined} count={12} /> },
};

export const SwitcherChip: Story = {
  args: {
    tone: 'gym',
    icon: 'barbell',
    actions: <BellButton label="Notifications" onClick={() => undefined} />,
  },
};

export const SwitcherChipApex: Story = {
  args: {
    app: 'Apex',
    tone: 'apex',
    icon: 'trophy',
    actions: <BellButton label="Notifications" onClick={() => undefined} count={3} />,
  },
};
