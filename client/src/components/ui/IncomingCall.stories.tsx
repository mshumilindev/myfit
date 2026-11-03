import type { Meta, StoryObj } from '@storybook/react-vite';
import { IncomingCall } from './IncomingCall';
import { noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/IncomingCall',
  component: IncomingCall,
  parameters: { layout: 'fullscreen' },
  args: {
    name: 'Anna Kovalenko',
    kind: 'Video call',
    sub: 'Your client',
    answerLabel: 'Answer',
    declineLabel: 'Decline',
    voiceOnlyLabel: 'Answer with voice only',
    onAnswer: noop,
    onDecline: noop,
    onVoiceOnly: noop,
  },
} satisfies Meta<typeof IncomingCall>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Phone: Story = {};
export const DesktopCard: Story = { args: { variant: 'card', voiceOnlyLabel: 'Voice only' } };
export const VoiceCall: Story = {
  args: { kind: 'Voice call', video: false, voiceOnlyLabel: undefined, onVoiceOnly: undefined },
};
