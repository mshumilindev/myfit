import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallBar } from './CallBar';
import { noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallBar',
  component: CallBar,
  args: {
    title: 'Call with Anna',
    time: '12:41',
    returnLabel: 'Back to the call',
    micOn: true,
    micLabel: 'Mute',
    onMic: noop,
    endLabel: 'End call',
    onEnd: noop,
    onReturn: noop,
  },
} satisfies Meta<typeof CallBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Muted: Story = { args: { micOn: false, micLabel: 'Unmute' } };
export const LongTitle: Story = {
  args: { title: 'Call with Aleksandra Wiśniewska-Kowalczyk, personal trainer' },
};
