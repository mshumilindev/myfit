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
import { CallState } from './CallState';
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

const End = (p: {
  status: string;
  icon: string;
  title: string;
  body: string;
  primary?: string;
  secondary?: string;
  steps?: string;
}) => (
  <CallScreen
    name="Anna Kovalenko"
    status={p.status}
    foot={
      <div className="uicall-end-act">
        {p.primary && (
          <Button variant="primary" onClick={noop}>
            {p.primary}
          </Button>
        )}
        <Button variant="secondary" onClick={noop}>
          {p.secondary ?? 'Close'}
        </Button>
      </div>
    }
  >
    <CallState name="Anna Kovalenko" icon={p.icon} title={p.title} body={p.body}>
      {p.steps && (
        <Notice tone="neutral" icon="info">
          {p.steps}
        </Notice>
      )}
    </CallState>
  </CallScreen>
);

export const EndedSummary: Story = {
  render: () => (
    <End
      status="Call ended"
      icon="phone-disconnect"
      title="Call ended · 12:41"
      body="It is saved in your chat with Anna."
      primary="Call again"
    />
  ),
};
export const Declined: Story = {
  render: () => (
    <End
      status="Declined"
      icon="phone-x"
      title="Anna declined the call"
      body="You can write to her in the chat."
      primary="Message"
    />
  ),
};
export const NoAnswer: Story = {
  render: () => (
    <End
      status="No answer"
      icon="phone-x"
      title="Anna did not answer"
      body="She will see a missed call in the chat."
      primary="Call again"
    />
  ),
};
export const Busy: Story = {
  render: () => (
    <End
      status="Busy"
      icon="phone-x"
      title="Anna is on another call"
      body="Try again in a few minutes."
      primary="Call again"
    />
  ),
};
export const Unavailable: Story = {
  render: () => (
    <End
      status="Unavailable"
      icon="moon"
      title="Anna is not available right now"
      body="Leave a message in the chat; she will see it when she is back."
      primary="Message"
    />
  ),
};
export const NoAccess: Story = {
  render: () => (
    <End
      status="Not available"
      icon="lock-simple"
      title="Calls are not available"
      body="You can call people you work with while your coaching link is active."
    />
  ),
};
export const ConnectionLost: Story = {
  render: () => (
    <End
      status="Connection lost"
      icon="wifi-slash"
      title="The call could not continue"
      body="Check your connection and try again."
      primary="Call again"
    />
  ),
};
export const OfflineCannotCall: Story = {
  render: () => (
    <End
      status="Offline"
      icon="cloud-slash"
      title="You are offline"
      body="Calls need an internet connection. Your chat messages will be sent when you are back online."
    />
  ),
};
export const PermissionAsk: Story = {
  render: () => (
    <End
      status="Before the call"
      icon="microphone"
      title="Allow the microphone and camera"
      body="Spotter uses them only during a call, and never records it."
      primary="Allow"
      secondary="Not now"
    />
  ),
};
export const PermissionDenied: Story = {
  render: () => (
    <End
      status="Microphone blocked"
      icon="microphone-slash"
      title="The microphone is blocked"
      body="Calls need the microphone. Allow it in your browser or system settings, then try again."
      primary="Try again"
      steps="Browser: the lock icon in the address bar, Site settings, Microphone, Allow."
    />
  ),
};
export const NoDevice: Story = {
  render: () => (
    <End
      status="No microphone"
      icon="microphone-slash"
      title="No microphone found"
      body="Connect a microphone or headset and try again."
      primary="Try again"
    />
  ),
};
export const Unsupported: Story = {
  render: () => (
    <End
      status="Not supported"
      icon="warning"
      title="This browser cannot make calls"
      body="Open Spotter in an up-to-date browser, or install the app."
    />
  ),
};
