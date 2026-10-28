import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './TabBar';

/**
 * Halloween Start lantern (SPO-378). Not a standalone control: it lives inside the TabBar centre `fab` and renders only
 * while the Halloween theme is active (pick it in the toolbar). The Gym shows the lantern; other apps keep the round
 * skin-coloured button. Candle and sway run only in the attention state, never under reduced motion or at night.
 */
const meta = {
  title: 'Kit/HalloweenLantern',
  component: TabBar,
  parameters: { layout: 'fullscreen' },
  globals: { theme: 'halloween' },
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

/** Idle: still lantern, no animation. */
export const Idle: Story = {};

/** Attention: the candle flickers and the pumpkin sways slowly (invites a session). */
export const Attention: Story = {
  args: { fab: { ariaLabel: 'Start', onClick: () => undefined, attention: true } },
};
