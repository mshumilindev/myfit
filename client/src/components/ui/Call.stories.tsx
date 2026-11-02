import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CallTile } from './CallTile';
import { CallControls } from './CallControls';
import { CallScreen } from './CallScreen';
import { IncomingCall } from './IncomingCall';
import { CallBar } from './CallBar';
import { CallMini } from './CallMini';
import { CallLogRow } from './CallLogRow';
import { CallActions } from './CallActions';
import { CallPreflight } from './CallPreflight';
import { Notice } from './Notice';
import { Button } from './Button';
import { Stack } from '../../stories/LocaleMatrix';

/** Stand-in for the live <video>: a plain gradient (the real element is a MediaStream). */
const Feed = ({ hue }: { hue: number }) => (
  <div
    style={{ background: `linear-gradient(135deg, hsl(${hue} 30% 32%), hsl(${hue + 40} 25% 18%))` }}
  />
);

const labels = {
  mic: 'Mute',
  micOn: 'Unmute',
  cam: 'Turn camera off',
  camOn: 'Turn camera on',
  flip: 'Flip camera',
  speaker: 'Speaker',
  end: 'End call',
  minimize: 'Minimise',
};
const noop = () => {};

const meta = {
  title: 'Kit/Call',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const Controls = (p: { video?: boolean; micOn?: boolean; camOn?: boolean }) => (
  <CallControls
    labels={labels}
    micOn={p.micOn ?? true}
    onMic={noop}
    camOn={p.video ? (p.camOn ?? true) : undefined}
    onCam={p.video ? noop : undefined}
    onFlip={p.video ? noop : undefined}
    speakerOn={!p.video}
    onSpeaker={p.video ? undefined : noop}
    onEnd={noop}
  />
);

export const Ringing: Story = {
  render: () => (
    <CallScreen
      name="Anna Kovalenko"
      status="Calling…"
      note="Not recorded"
      foot={<Controls />}
      onMinimize={noop}
      minimizeLabel="Minimise"
    >
      <CallTile name="Anna Kovalenko" />
    </CallScreen>
  ),
};

export const VideoLive: Story = {
  render: () => (
    <CallScreen
      name="Anna Kovalenko"
      status="12:41"
      note="Not recorded"
      foot={<Controls video />}
      onMinimize={noop}
      minimizeLabel="Minimise"
    >
      <CallTile name="Anna Kovalenko" video={<Feed hue={200} />} />
      <CallTile name="You" self video={<Feed hue={20} />} />
    </CallScreen>
  ),
};

export const VoiceOnly: Story = {
  render: () => (
    <CallScreen
      name="Anna Kovalenko"
      status="03:08"
      note="Not recorded"
      foot={<Controls />}
      onMinimize={noop}
      minimizeLabel="Minimise"
    >
      <CallTile name="Anna Kovalenko" />
    </CallScreen>
  ),
};

export const CameraAndMicOff: Story = {
  render: () => (
    <CallScreen
      name="Anna Kovalenko"
      status="12:41"
      note="Not recorded"
      foot={<Controls video micOn={false} camOn={false} />}
      onMinimize={noop}
      minimizeLabel="Minimise"
    >
      <CallTile name="Anna Kovalenko" video={<Feed hue={200} />} micOff />
      <CallTile name="You" self />
    </CallScreen>
  ),
};

export const WeakConnection: Story = {
  render: () => (
    <CallScreen
      name="Anna Kovalenko"
      status="12:41"
      note="Not recorded"
      notice={
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
      }
      foot={<Controls video />}
      onMinimize={noop}
      minimizeLabel="Minimise"
    >
      <CallTile name="Anna Kovalenko" video={<Feed hue={200} />} />
      <CallTile name="You" self video={<Feed hue={20} />} />
    </CallScreen>
  ),
};

export const Reconnecting: Story = {
  render: () => (
    <CallScreen
      name="Anna Kovalenko"
      status="Reconnecting…"
      note="Not recorded"
      notice={
        <Notice tone="neutral" icon="arrows-clockwise">
          Trying to restore the connection
        </Notice>
      }
      foot={<Controls />}
    >
      <CallTile name="Anna Kovalenko" />
    </CallScreen>
  ),
};

export const IncomingPhone: Story = {
  render: () => (
    <IncomingCall
      name="Anna Kovalenko"
      kind="Video call"
      sub="Your client"
      answerLabel="Answer"
      declineLabel="Decline"
      voiceOnlyLabel="Answer with voice only"
      onAnswer={noop}
      onDecline={noop}
      onVoiceOnly={noop}
    />
  ),
};

export const IncomingDesktopCard: Story = {
  render: () => (
    <IncomingCall
      variant="card"
      name="Anna Kovalenko"
      kind="Video call"
      sub="Your client"
      answerLabel="Answer"
      declineLabel="Decline"
      voiceOnlyLabel="Voice only"
      onAnswer={noop}
      onDecline={noop}
      onVoiceOnly={noop}
    />
  ),
};

export const BarAndMini: Story = {
  render: () => (
    <Stack>
      <CallBar
        title="Call with Anna"
        time="12:41"
        returnLabel="Back to the call"
        micOn
        micLabel="Mute"
        onMic={noop}
        endLabel="End call"
        onEnd={noop}
        onReturn={noop}
      />
      <CallMini
        name="Anna Kovalenko"
        video={<Feed hue={200} />}
        time="12:41"
        expandLabel="Expand the call"
        endLabel="End call"
        onExpand={noop}
        onEnd={noop}
      />
    </Stack>
  ),
};

export const LogRows: Story = {
  render: () => (
    <Stack>
      <CallLogRow kind="done" video text="Video call · 12 min" time="18:40" />
      <CallLogRow
        kind="missed"
        video={false}
        text="Missed call"
        time="09:12"
        callBackLabel="Call back"
        onCallBack={noop}
      />
      <CallLogRow kind="declined" video text="Call declined" time="Yesterday" />
      <CallLogRow
        kind="noanswer"
        video={false}
        text="No answer"
        time="Yesterday"
        callBackLabel="Call again"
        onCallBack={noop}
      />
      <CallLogRow kind="failed" video text="Call failed — connection lost" time="Mon" />
    </Stack>
  ),
};

export const EntryButtons: Story = {
  render: () => (
    <Stack>
      <CallActions voiceLabel="Voice call" videoLabel="Video call" onVoice={noop} onVideo={noop} />
      <CallActions
        voiceLabel="Voice call"
        videoLabel="Video call"
        onVoice={noop}
        onVideo={noop}
        disabledReason="Offline"
      />
    </Stack>
  ),
};

export const Preflight: Story = {
  render: function Render() {
    const [cam, setCam] = useState(true);
    return (
      <div style={{ width: 358, padding: 16 }}>
        <CallPreflight
          preview={<Feed hue={20} />}
          level={0.6}
          levelLabel="Microphone level"
          cameraLabel="Camera"
          cameraOn={cam}
          onCamera={setCam}
          micLabel="Microphone"
          micDevice="a"
          micDevices={[{ id: 'a', label: 'Built-in microphone' }]}
          onMicDevice={noop}
          camLabel="Camera"
          camDevice="a"
          camDevices={[{ id: 'a', label: 'FaceTime HD camera' }]}
          onCamDevice={noop}
        />
      </div>
    );
  },
};

export const TileStates: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        width: 358,
        height: 220,
        padding: 16,
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative' }}>
        <CallTile name="Anna Kovalenko" video={<Feed hue={200} />} />
      </div>
      <div style={{ position: 'relative' }}>
        <CallTile name="Anna Kovalenko" micOff />
      </div>
    </div>
  ),
};
