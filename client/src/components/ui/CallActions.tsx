import { IconButton } from './Button';
import './Call.css';

export interface CallActionsProps {
  voiceLabel: string;
  videoLabel: string;
  onVoice: () => void;
  onVideo: () => void;
  /** Why the buttons are off ("No connection"); both are disabled and the reason is their tooltip. */
  disabledReason?: string;
  size?: 'sm' | 'md';
}

/**
 * The two entry buttons of a call (kit group `Call`): voice and video. Every screen that can start a call draws these
 * two, never its own variant (chat bar, client card, roster row, session, My trainer).
 */
export function CallActions({
  voiceLabel,
  videoLabel,
  onVoice,
  onVideo,
  disabledReason,
  size = 'md',
}: CallActionsProps) {
  const off = !!disabledReason;
  return (
    <span className="uicall-act">
      <IconButton
        icon="phone"
        label={voiceLabel}
        size={size}
        disabled={off}
        title={off ? disabledReason : voiceLabel}
        onClick={onVoice}
      />
      <IconButton
        icon="video-camera"
        label={videoLabel}
        size={size}
        disabled={off}
        title={off ? disabledReason : videoLabel}
        onClick={onVideo}
      />
    </span>
  );
}
