import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallRings } from './CallRings';
import { Row } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/CallRings',
  component: CallRings,
  args: { name: 'Anna Kovalenko' },
} satisfies Meta<typeof CallRings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ringing: Story = {};
export const Still: Story = { args: { ringing: false } };
export const Sizes: Story = {
  render: () => (
    <Row gap={32}>
      <CallRings name="Anna Kovalenko" size={72} />
      <CallRings name="Anna Kovalenko" size={120} />
      <CallRings name="Anna Kovalenko" size={160} />
    </Row>
  ),
};
