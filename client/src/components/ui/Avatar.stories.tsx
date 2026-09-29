import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { Row } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Avatar',
  component: Avatar,
  args: { name: 'Mykola Lukianov', size: 40 },
} satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Sizes, initials vs photo, one-word names. */
export const Sizes: Story = {
  render: () => (
    <Row>
      <Avatar name="Mykola Lukianov" size={24} />
      <Avatar name="Anna" size={32} />
      <Avatar name="Oleh Petrenko" size={40} />
      <Avatar name="Iryna" size={56} />
      <Avatar name="Marek" size={72} src="/atlas/atlas-1.webp" />
    </Row>
  ),
};
