import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { CallTile } from './CallTile';
import { CallScreen } from './CallScreen';
import { IncomingCall } from './IncomingCall';
import { CallBar } from './CallBar';
import { CallMini } from './CallMini';
import { CallLogRow } from './CallLogRow';
import { CallActions } from './CallActions';
import { CallPreflight } from './CallPreflight';
import { Stack } from '../../stories/LocaleMatrix';
import { Controls, Feed, noop, talkerLevel } from '../../stories/callFixtures';

/**
 * The call group as composed canvases. The per-primitive stories live beside the components
 * (`Kit/CallRoundButton`, `Kit/CallScreen`, `Kit/CallState`, …). This file stays ONLY because the design
 * screens reference these ids: `kit-call--voice-live`, `incoming-phone`, `ringing`, `bar-and-mini`,
 * `log-rows`, `entry-buttons`, `preflight`. Do not rename or remove them.
 */
const meta = {
  title: 'Kit/Call',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

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
      <CallTile name="Anna Kovalenko" ringing />
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

/** Voice bars driven by a level, here a simulated talker; in the app the level is the microphone / remote stream RMS. */
export const VoiceLive: Story = {
  render: function Render() {
    const [t, setT] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setT((v) => v + 1), 70);
      return () => clearInterval(id);
    }, []);
    return (
      <CallScreen
        name="Anna Kovalenko"
        status="03:08"
        note="Not recorded"
        foot={<Controls />}
        onMinimize={noop}
        minimizeLabel="Minimise"
      >
        <CallTile name="Anna Kovalenko" wave waveLevel={talkerLevel(t)} wavePhase={t / 4} />
      </CallScreen>
    );
  },
};
