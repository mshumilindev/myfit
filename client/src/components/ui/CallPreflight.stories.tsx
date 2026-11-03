import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallPreflight } from './CallPreflight';
import { Feed, noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallPreflight',
  component: CallPreflight,
  args: {
    preview: <Feed hue={20} />,
    level: 0.6,
    levelLabel: 'Microphone level',
    cameraLabel: 'Camera',
    cameraOn: true,
    onCamera: noop,
    micLabel: 'Microphone',
    micDevice: 'a',
    micDevices: [{ id: 'a', label: 'Built-in microphone' }],
    onMicDevice: noop,
    camLabel: 'Camera',
    camDevice: 'a',
    camDevices: [{ id: 'a', label: 'FaceTime HD camera' }],
    onCamDevice: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallPreflight>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Silent: Story = { args: { level: 0 } };
export const CameraOff: Story = { args: { cameraOn: false, preview: undefined } };
