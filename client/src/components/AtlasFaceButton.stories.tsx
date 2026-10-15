import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Button } from './ui/Button';
import { AtlasFace } from './AtlasFace';

/**
 * Atlas's face as a button (the chat header, SPO-95). Hover, focus and press follow the avatar's circle: a tight ghost
 * round button, never a capsule around it. Each state has its own story (hover / focus are driven by a play function).
 */
const meta = {
  title: 'Components/Atlas face button',
  parameters: { layout: 'centered' },
  render: () => (
    <Button variant="ghost" size="sm" shape="round" hug aria-label="Atlas" className="atl-face-btn">
      <AtlasFace temper={5} size={38} />
    </Button>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {};
export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'));
  },
};
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    within(canvasElement).getByRole('button').focus();
  },
};
