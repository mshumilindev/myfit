import { CallRoundButton } from './CallRoundButton';
import './Call.css';

export interface CallControlsLabels {
  mic: string;
  micOn: string;
  cam: string;
  camOn: string;
  flip: string;
  speaker: string;
  end: string;
  minimize: string;
}

export interface CallControlsProps {
  labels: CallControlsLabels;
  micOn: boolean;
  onMic: () => void;
  /** Video call: camera toggle (and flip on a phone). Omit `onCam` for a voice-only call. */
  camOn?: boolean;
  onCam?: () => void;
  onFlip?: () => void;
  /** Phone only: loudspeaker toggle. */
  speakerOn?: boolean;
  onSpeaker?: () => void;
  onEnd: () => void;
}

/**
 * The call's button row (kit group `Call`): mic, camera, flip, speaker, and the red hang-up. Every button is a kit round
 * IconButton; an "off" state is the filled danger-soft one, so it reads without colour alone (icon changes too).
 */
export function CallControls({
  labels,
  micOn,
  onMic,
  camOn,
  onCam,
  onFlip,
  speakerOn,
  onSpeaker,
  onEnd,
}: CallControlsProps) {
  return (
    <div className="uicall-ctl" role="toolbar" aria-label={labels.end}>
      <CallRoundButton
        tone={micOn ? 'neutral' : 'light'}
        icon={micOn ? 'microphone' : 'microphone-slash'}
        label={micOn ? labels.mic : labels.micOn}
        aria-pressed={!micOn}
        onClick={onMic}
      />
      {onCam && (
        <CallRoundButton
          tone={camOn ? 'neutral' : 'light'}
          icon={camOn ? 'video-camera' : 'video-camera-slash'}
          label={camOn ? labels.cam : labels.camOn}
          aria-pressed={!camOn}
          onClick={onCam}
        />
      )}
      {onFlip && <CallRoundButton icon="camera-rotate" label={labels.flip} onClick={onFlip} />}
      {onSpeaker && (
        <CallRoundButton
          tone={speakerOn ? 'light' : 'neutral'}
          icon="speaker-high"
          label={labels.speaker}
          aria-pressed={!!speakerOn}
          onClick={onSpeaker}
        />
      )}
      <CallRoundButton tone="danger" icon="phone-disconnect" label={labels.end} onClick={onEnd} />
    </div>
  );
}
