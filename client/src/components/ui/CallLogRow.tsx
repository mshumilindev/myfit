import { Icon } from '../../ui';
import { Button } from './Button';
import { toneClass, type Tone } from './tones';
import './Call.css';

export type CallLogKind = 'done' | 'missed' | 'declined' | 'noanswer' | 'failed';

export interface CallLogRowProps {
  kind: CallLogKind;
  video: boolean;
  /** "Video call · 12 min" / "Missed video call". */
  text: string;
  /** "Today 18:40" */
  time: string;
  /** Call back (not for the trainer-side of a declined one if the product says so). */
  callBackLabel?: string;
  onCallBack?: () => void;
}

const TONE: Record<CallLogKind, Tone> = {
  done: 'ok',
  missed: 'danger',
  declined: 'neutral',
  noanswer: 'neutral',
  failed: 'danger',
};
const ICON: Record<CallLogKind, [string, string]> = {
  done: ['phone-call', 'video-camera'],
  missed: ['phone-incoming', 'video-camera-slash'],
  declined: ['phone-x', 'phone-x'],
  noanswer: ['phone-x', 'phone-x'],
  failed: ['wifi-slash', 'wifi-slash'],
};

/**
 * A call in the chat history (kit group `Call`): a centred system line with the outcome, time and a "Call back" action.
 * Missed and failed ones carry the danger tone so they are found when scrolling back.
 */
export function CallLogRow({
  kind,
  video,
  text,
  time,
  callBackLabel,
  onCallBack,
}: CallLogRowProps) {
  return (
    <div className={`uicall-log ${toneClass(TONE[kind])}`}>
      <Icon name={ICON[kind][video ? 1 : 0]} className="uicall-log-i" />
      <span className="uicall-log-t">
        {text}
        <small>{time}</small>
      </span>
      {callBackLabel && onCallBack && (
        <Button variant="link" size="sm" onClick={onCallBack}>
          {callBackLabel}
        </Button>
      )}
    </div>
  );
}
