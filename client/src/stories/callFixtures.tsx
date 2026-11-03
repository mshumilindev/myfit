import { CallControls } from '../components/ui/CallControls';
import { CallSessionChip } from '../components/ui/CallSessionChip';

/** Stand-in for the live <video>: a plain gradient (the real element is a MediaStream). */
export const Feed = ({ hue }: { hue: number }) => (
  <div
    style={{ background: `linear-gradient(135deg, hsl(${hue} 30% 32%), hsl(${hue + 40} 25% 18%))` }}
  />
);

export const callLabels = {
  mic: 'Mute',
  micOn: 'Unmute',
  cam: 'Turn camera off',
  camOn: 'Turn camera on',
  flip: 'Flip camera',
  speaker: 'Speaker',
  end: 'End call',
  minimize: 'Minimise',
};

export const noop = () => {};

export const Controls = (p: { video?: boolean; micOn?: boolean; camOn?: boolean }) => (
  <CallControls
    labels={callLabels}
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

export const sessionChip = (
  <CallSessionChip
    title="Barbell Bench Press"
    detail="Set 2 of 4 · rest"
    time="1:32"
    openLabel="Back to your workout"
    onOpen={noop}
  />
);

/** A simulated talker for the live voice bars; in the app the level is the microphone / remote stream RMS. */
export function talkerLevel(t: number) {
  const talking = Math.sin(t / 14) > -0.3;
  return talking ? 0.35 + 0.65 * Math.abs(Math.sin(t / 3.1) * Math.cos(t / 7)) : 0;
}
