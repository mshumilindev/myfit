import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallVideo } from './CallVideo';

/** A moving picture from a canvas, so the story needs no camera. */
function useCanvasStream(): MediaStream | null {
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    const g = c.getContext('2d');
    let n = 0;
    const id = setInterval(() => {
      if (!g) return;
      g.fillStyle = `hsl(${(n += 4) % 360} 40% 35%)`;
      g.fillRect(0, 0, c.width, c.height);
    }, 80);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stream exists only after the canvas does
    setStream(typeof c.captureStream === 'function' ? c.captureStream(12) : null);
    return () => clearInterval(id);
  }, []);
  return stream;
}

function Live({ self }: { self?: boolean }) {
  const stream = useCanvasStream();
  return <CallVideo stream={stream} self={self} label={self ? 'You' : 'Anna Kovalenko'} />;
}

const meta = {
  title: 'Kit/CallVideo',
  component: CallVideo,
  parameters: { layout: 'fullscreen' },
  args: { stream: null },
  decorators: [
    (Story) => (
      <div
        style={{ position: 'relative', width: 358, height: 220, margin: 16, overflow: 'hidden' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallVideo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoStream: Story = {};
export const Remote: Story = { render: () => <Live /> };
export const SelfMirrored: Story = { render: () => <Live self /> };
