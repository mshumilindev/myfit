import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallMini } from './CallMini';
import { Feed, noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallMini',
  component: CallMini,
  args: {
    name: 'Anna Kovalenko',
    video: <Feed hue={200} />,
    time: '12:41',
    expandLabel: 'Expand the call',
    endLabel: 'End call',
    onExpand: noop,
    onEnd: noop,
  },
} satisfies Meta<typeof CallMini>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Video: Story = {};
export const Voice: Story = { args: { video: undefined } };
