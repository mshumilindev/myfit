import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallScreen } from './CallScreen';
import { CallTile } from './CallTile';
import { Notice } from './Notice';
import { Button } from './Button';
import { Controls, Feed, noop, sessionChip } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallScreen',
  component: CallScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    name: 'Anna Kovalenko',
    status: '12:41',
    note: 'Not recorded',
    foot: <Controls video />,
    onMinimize: noop,
    minimizeLabel: 'Minimise',
    children: null,
  },
} satisfies Meta<typeof CallScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

const twoVideos = (
  <>
    <CallTile name="Anna Kovalenko" video={<Feed hue={200} />} />
    <CallTile name="You" self video={<Feed hue={20} />} />
  </>
);

export const Ringing: Story = {
  args: {
    status: 'Calling…',
    foot: <Controls />,
    children: <CallTile name="Anna Kovalenko" ringing />,
  },
};
export const VideoLive: Story = { args: { children: twoVideos } };
export const VoiceOnly: Story = {
  args: { status: '03:08', foot: <Controls />, children: <CallTile name="Anna Kovalenko" wave /> },
};
export const CameraAndMicOff: Story = {
  args: {
    foot: <Controls video micOn={false} camOn={false} />,
    children: (
      <>
        <CallTile name="Anna Kovalenko" video={<Feed hue={200} />} micOff />
        <CallTile name="You" self />
      </>
    ),
  },
};
export const WeakConnection: Story = {
  args: {
    notice: (
      <Notice
        tone="danger"
        icon="wifi-slash"
        trail={
          <Button variant="link" size="sm">
            Voice only
          </Button>
        }
      >
        Weak connection
      </Notice>
    ),
    children: twoVideos,
  },
};
export const Reconnecting: Story = {
  args: {
    status: 'Reconnecting…',
    foot: <Controls />,
    onMinimize: undefined,
    notice: (
      <Notice tone="neutral" icon="arrows-clockwise">
        Trying to restore the connection
      </Notice>
    ),
    children: <CallTile name="Anna Kovalenko" />,
  },
};

/** A call during a workout: the session strip under the header; one tap goes back to the session. */
const duringWorkout = {
  name: 'Iryna Melnyk',
  session: sessionChip,
  minimizeLabel: 'Back to your workout',
  onToggleFull: noop,
  fullLabel: 'Full screen',
};
export const VideoDuringWorkout: Story = {
  args: {
    ...duringWorkout,
    children: (
      <>
        <CallTile name="Iryna Melnyk" video={<Feed hue={200} />} />
        <CallTile name="You" self video={<Feed hue={20} />} />
      </>
    ),
  },
};
export const VoiceDuringWorkout: Story = {
  args: {
    ...duringWorkout,
    status: '03:08',
    foot: <Controls />,
    children: <CallTile name="Iryna Melnyk" wave />,
  },
};

/** Desktop: the same call in the whole window. */
export const ModeFull: Story = {
  args: { ...VideoDuringWorkout.args, mode: 'full', fullLabel: 'Exit full screen' },
};
/** Desktop: a side panel on the right, the workout beside it stays usable. */
export const ModeDock: Story = {
  args: { ...VideoDuringWorkout.args, mode: 'dock', fullLabel: 'Full screen' },
};
