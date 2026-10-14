import { Card } from './Card';
import './WeekdayToggle.css';

export interface WeekdayToggleDay {
  id: string;
  /** Visible day word ("Tue" / "Tu"). */
  label: string;
  /** Second line ("With Iryna", "Solo", "Rest"); hidden on a phone width when `compactSub`. */
  sub?: string;
  on: boolean;
  /** Not selectable (a rest day): drawn as a quiet static tile, not as a disabled button. */
  disabled?: boolean;
  /** Spoken in full ("Tuesday, with Iryna"). */
  ariaLabel: string;
}

export interface WeekdayToggleProps {
  days: readonly WeekdayToggleDay[];
  onToggle: (id: string) => void;
  /** Group label ("Days with Iryna"). */
  label: string;
  /** Read only (a client sees it, a trainer edits it). */
  readOnly?: boolean;
}

/**
 * Seven weekday tiles, each on / off / disabled (kit group `Coach/Weekday toggle`): trainer days on an assignment, the
 * week strip of a program. The selected one is the accent glass tile; state is also said in the second line, never colour only.
 */
export function WeekdayToggle({ days, onToggle, label, readOnly }: WeekdayToggleProps) {
  return (
    <div className="uiwd" role="group" aria-label={label}>
      {days.map((d) =>
        readOnly || d.disabled ? (
          <Card
            key={d.id}
            pad="none"
            tone={d.on ? 'accent' : 'neutral'}
            emphasis="quiet"
            className={['uiwd-d', 'is-static', d.on ? 'is-on' : ''].filter(Boolean).join(' ')}
            role="img"
            aria-label={d.ariaLabel}
          >
            <span className="uiwd-l">{d.label}</span>
            {d.sub && <small className="uiwd-s">{d.sub}</small>}
          </Card>
        ) : (
          <Card
            key={d.id}
            as="button"
            pad="none"
            tone={d.on ? 'accent' : 'neutral'}
            emphasis={d.on ? 'glass' : 'card'}
            className={['uiwd-d', d.on ? 'is-on' : ''].filter(Boolean).join(' ')}
            aria-pressed={d.on}
            aria-label={d.ariaLabel}
            disabled={d.disabled}
            onClick={() => onToggle(d.id)}
          >
            <span className="uiwd-l">{d.label}</span>
            {d.sub && <small className="uiwd-s">{d.sub}</small>}
          </Card>
        ),
      )}
    </div>
  );
}
