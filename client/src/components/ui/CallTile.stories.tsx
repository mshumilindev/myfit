import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallTile } from './CallTile';
import { Feed, talkerLevel } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallTile',
  component: CallTile,
  parameters: { layout: 'fullscreen' },
  args: { name: 'Anna Kovalenko' },
  decorators: [
    (Story) => (
      <div
        style={{ position: 'relative', width: 358, height: 220, margin: 16, overflow: 'hidden' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ringing: Story = { args: { ringing: true } };
export const Video: Story = { args: { video: <Feed hue={200} /> } };
export const VideoMicOff: Story = { args: { video: <Feed hue={200} />, micOff: true } };
export const NoVideoMicOff: Story = { args: { micOff: true } };
export const SelfVideo: Story = { args: { name: 'You', self: true, video: <Feed hue={20} /> } };
export const SelfCameraOff: Story = { args: { name: 'You', self: true } };
export const Small: Story = { args: { small: true, video: <Feed hue={200} /> } };
export const VoiceBreathing: Story = { args: { wave: true } };

export const VoiceLive: Story = {
  render: function Render() {
    const [t, setT] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setT((v) => v + 1), 70);
      return () => clearInterval(id);
    }, []);
    return <CallTile name="Anna Kovalenko" wave waveLevel={talkerLevel(t)} wavePhase={t / 4} />;
  },
};
