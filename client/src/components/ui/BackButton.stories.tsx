import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackButton } from './BackButton';

const meta = {
  title: 'Kit/BackButton',
  component: BackButton,
  args: { label: 'Back' },
} satisfies Meta<typeof BackButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** With the destination — replaces the old "‹ Overview" link. */
export const WithText: Story = { args: { text: 'Overview' } };

/** Over a photo or hero image. */
export const Overlay: Story = { args: { overlay: true } };
