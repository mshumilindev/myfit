import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallControls } from './CallControls';
import { callLabels, noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallControls',
  component: CallControls,
  args: { labels: callLabels, micOn: true, onMic: noop, onEnd: noop },
} satisfies Meta<typeof CallControls>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Voice call: mic, speaker, hang up. */
export const Voice: Story = { args: { speakerOn: true, onSpeaker: noop } };
export const VoiceMuted: Story = { args: { micOn: false, speakerOn: true, onSpeaker: noop } };
/** Video call: mic, camera, flip, hang up. */
export const Video: Story = { args: { camOn: true, onCam: noop, onFlip: noop } };
export const VideoMicAndCameraOff: Story = {
  args: { micOn: false, camOn: false, onCam: noop, onFlip: noop },
};
