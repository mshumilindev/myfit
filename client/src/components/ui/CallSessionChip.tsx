import { Icon } from '../../ui';
import './Call.css';

export interface CallSessionChipProps {
  /** Current exercise ("Barbell Bench Press"). */
  title: string;
  /** Where the person is ("Set 2 of 4 · rest"). */
  detail: string;
  /** Rest or workout timer, tabular ("1:32"). */
  time: string;
  /** Accessible name of the chip ("Back to your workout"). */
  openLabel: string;
  onOpen: () => void;
}

/**
 * The live workout inside a call (kit group `Call`): exercise, set and the rest timer in one strip under the call header.
 * One tap goes back to the session with the call kept as the mini window; this is how a person trains and talks to the
 * trainer in the same minute.
 */
export function CallSessionChip({ title, detail, time, openLabel, onOpen }: CallSessionChipProps) {
  return (
    <button
      type="button"
      className="uicall-sess"
      aria-label={`${openLabel}: ${title}`}
      onClick={onOpen}
    >
      <Icon name="barbell" className="uicall-sess-i" />
      <span className="uicall-sess-t">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      <span className="uicall-sess-time">{time}</span>
      <Icon name="caret-right" className="uicall-sess-go" />
    </button>
  );
}
