import { ActionMenu } from './ActionMenu';
import { Button, IconButton } from './Button';
import './Call.css';

export interface CallActionsProps {
  voiceLabel: string;
  videoLabel: string;
  onVoice: () => void;
  onVideo: () => void;
  /** Why the buttons are off ("No connection"); both are disabled and the reason is their tooltip. */
  disabledReason?: string;
  size?: 'sm' | 'md';
  /** Narrow headers (a phone chat bar): ONE phone button that opens a two-item menu instead of two buttons. */
  compact?: boolean;
  /** Next to text buttons (a card, the roster detail): two labelled Buttons instead of two icons. */
  labeled?: boolean;
  /** Name of the single button in `compact` mode ("Call"). */
  callLabel?: string;
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
  compact,
  labeled,
  callLabel,
}: CallActionsProps) {
  const off = !!disabledReason;
  if (labeled) {
    return (
      <span className="uicall-act">
        <Button
          variant="secondary"
          icon="phone"
          disabled={off}
          title={off ? disabledReason : undefined}
          onClick={onVoice}
        >
          {voiceLabel}
        </Button>
        <Button
          variant="secondary"
          icon="video-camera"
          disabled={off}
          title={off ? disabledReason : undefined}
          onClick={onVideo}
        >
          {videoLabel}
        </Button>
      </span>
    );
  }
  if (compact) {
    return (
      <ActionMenu
        icon="phone"
        label={callLabel ?? voiceLabel}
        items={[
          { id: 'voice', label: voiceLabel, icon: 'phone', onSelect: onVoice, disabled: off },
          {
            id: 'video',
            label: videoLabel,
            icon: 'video-camera',
            onSelect: onVideo,
            disabled: off,
          },
        ]}
        note={off ? disabledReason : undefined}
      />
    );
  }
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
