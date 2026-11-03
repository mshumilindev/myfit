import { Icon } from '../../ui';
import { Button, IconButton } from './Button';
import './Call.css';

export interface CallBarProps {
  /** "In call with Anna" */
  title: string;
  /** Running time "12:41". */
  time: string;
  returnLabel: string;
  micOn: boolean;
  micLabel: string;
  onMic: () => void;
  endLabel: string;
  onEnd: () => void;
  onReturn: () => void;
}

/**
 * The strip shown while a call runs and you are on another page (kit group `Call`). It sits under the app header, takes
 * the width, and never covers it. Tapping it (or Return) brings the call back; mic and hang-up work from here.
 */
export function CallBar({
  title,
  time,
  returnLabel,
  micOn,
  micLabel,
  onMic,
  endLabel,
  onEnd,
  onReturn,
}: CallBarProps) {
  return (
    <div className="uicall-bar" role="status">
      <Icon name="phone-call" className="uicall-bar-i" />
      <button type="button" className="uicall-bar-main" onClick={onReturn} aria-label={returnLabel}>
        <b>{title}</b>
        <span>{time}</span>
      </button>
      <IconButton
        icon={micOn ? 'microphone' : 'microphone-slash'}
        label={micLabel}
        size="sm"
        variant={micOn ? 'ghost' : 'danger-soft'}
        onClick={onMic}
      />
      <Button variant="danger" size="sm" icon="phone-disconnect" onClick={onEnd}>
        {endLabel}
      </Button>
    </div>
  );
}
