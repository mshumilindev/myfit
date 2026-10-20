import { Avatar } from './Avatar';
import './LockerWall.css';

export interface LockerPerson {
  id: string;
  name: string;
  /** Photo URL; initials when missing. */
  avatar?: string | null;
}

export interface LockerWallProps {
  people: LockerPerson[];
  /** The person that is selected (brass outline). */
  activeId?: string;
  /** The person whose locker is open (signing in); that locker shows `openLabel`. */
  openId?: string;
  /** Text of the chip on the open locker. */
  openLabel?: string;
  /** Accessible name of the whole wall. */
  label: string;
  /** Accessible name of one locker (the visible number is decoration). */
  lockerLabel: (name: string, index: number) => string;
  onSelect: (id: string) => void;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * The people a device remembers, as lockers: avatar, number, first name (kit `lockerwall`).
 * One tap on a locker = "this is me". Used by the landing before sign-in.
 */
export function LockerWall({
  people,
  activeId,
  openId,
  openLabel,
  label,
  lockerLabel,
  onSelect,
}: LockerWallProps) {
  return (
    <div className="uilw" role="group" aria-label={label}>
      {people.map((p, i) => {
        const open = p.id === openId;
        const on = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            className={`uilw-locker${on ? ' is-on' : ''}${open ? ' is-open' : ''}`}
            aria-label={lockerLabel(p.name, i)}
            aria-pressed={on}
            onClick={() => onSelect(p.id)}
          >
            <span className="uilw-vents" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="uilw-av" aria-hidden="true">
              <Avatar name={p.name} src={p.avatar} size={44} />
            </span>
            <span className="uilw-num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="uilw-tag">{firstName(p.name)}</span>
            <i className="uilw-handle" aria-hidden="true" />
            {open && openLabel && <span className="uilw-sr">{openLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
