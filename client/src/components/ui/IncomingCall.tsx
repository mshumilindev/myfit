import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Avatar } from './Avatar';
import { CallRings } from './CallRings';
import { CallRoundButton } from './CallRoundButton';
import { Button } from './Button';
import './Call.css';

export interface IncomingCallProps {
  name: string;
  photo?: string | null;
  /** "Video call" / "Voice call". */
  kind: string;
  /** Small line (programme, "Your trainer"). */
  sub?: ReactNode;
  answerLabel: string;
  declineLabel: string;
  /** Answer with voice only (video call): a quiet text action. */
  voiceOnlyLabel?: string;
  onAnswer: () => void;
  onDecline: () => void;
  onVoiceOnly?: () => void;
  /** `screen`: a whole phone screen; `card`: a floating card over the app on desktop. */
  variant?: 'screen' | 'card';
  /** false for a voice call: the kind chip shows a phone, not a camera. */
  video?: boolean;
}

/**
 * An incoming call (kit group `Call`). On a phone it takes the screen (big avatar, name, answer / decline); on desktop it
 * is a card that floats over whatever page is open and never blocks it. The ringing itself (sound, vibration) is the
 * platform's; this is only what is drawn.
 */
export function IncomingCall({
  name,
  photo,
  kind,
  sub,
  answerLabel,
  declineLabel,
  voiceOnlyLabel,
  onAnswer,
  onDecline,
  onVoiceOnly,
  variant = 'screen',
  video = true,
}: IncomingCallProps) {
  const card = variant === 'card';
  return (
    <section
      className={card ? 'uicall-in uicall-in--card' : 'uicall-in'}
      role="alertdialog"
      aria-label={`${name}: ${kind}`}
    >
      {card ? (
        <Avatar
          name={name}
          src={photo}
          size={48}
          className="uicall-in-av"
          style={{ fontSize: 'var(--fs-18)' }}
        />
      ) : (
        <CallRings name={name} photo={photo} size={120} />
      )}
      <div className="uicall-in-t">
        <span className="uicall-in-kind">
          <Icon name={video ? 'video-camera' : 'phone'} />
          {kind}
        </span>
        <b>{name}</b>
        {sub && <span className="uicall-in-sub">{sub}</span>}
      </div>
      {card ? (
        <div className="uicall-in-act">
          <Button variant="danger" icon="phone-x" onClick={onDecline}>
            {declineLabel}
          </Button>
          <Button variant="ok-fill" icon="phone-call" onClick={onAnswer}>
            {answerLabel}
          </Button>
        </div>
      ) : (
        <div className="uicall-in-act">
          <CallRoundButton
            tone="danger"
            size="lg"
            icon="phone-x"
            label={declineLabel}
            onClick={onDecline}
          />
          <CallRoundButton
            tone="ok"
            size="lg"
            icon="phone-call"
            label={answerLabel}
            onClick={onAnswer}
          />
        </div>
      )}
      {voiceOnlyLabel && onVoiceOnly && (
        <Button variant="secondary" size="sm" icon="phone" onClick={onVoiceOnly}>
          {voiceOnlyLabel}
        </Button>
      )}
    </section>
  );
}
