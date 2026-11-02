import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
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
}: IncomingCallProps) {
  const card = variant === 'card';
  return (
    <section
      className={card ? 'uicall-in uicall-in--card' : 'uicall-in'}
      role="alertdialog"
      aria-label={`${name}: ${kind}`}
    >
      <Avatar name={name} src={photo} size={card ? 48 : 120} className="uicall-in-av" />
      <div className="uicall-in-t">
        <small className="uicall-in-kind">{kind}</small>
        <b>{name}</b>
        {sub && <span className="uicall-in-sub">{sub}</span>}
      </div>
      <div className="uicall-in-act">
        <Button
          variant="danger"
          shape="round"
          size={card ? 'md' : 'lg'}
          icon="phone-x"
          onClick={onDecline}
        >
          {declineLabel}
        </Button>
        <Button
          variant="ok-fill"
          shape="round"
          size={card ? 'md' : 'lg'}
          icon="phone-call"
          onClick={onAnswer}
        >
          {answerLabel}
        </Button>
      </div>
      {voiceOnlyLabel && onVoiceOnly && (
        <Button variant="link" size="sm" onClick={onVoiceOnly}>
          {voiceOnlyLabel}
        </Button>
      )}
    </section>
  );
}
