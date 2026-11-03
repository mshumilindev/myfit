import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '../../ui';
import './Call.css';

export interface CallRoundButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: string;
  /** Visible caption under the circle; also the accessible name. */
  label: string;
  /**
   * `neutral` a glass circle; `light` the filled-light circle of a switched ("muted") control; `ok` answer;
   * `danger` the solid red hang-up / decline.
   */
  tone?: 'neutral' | 'light' | 'ok' | 'danger';
  size?: 'md' | 'lg';
}

/**
 * The round call button with its caption underneath (kit group `Call`): answer, decline, hang up, mic, camera, flip,
 * speaker. One shape for every control of a call, so the screen reads like a phone, not like a form. A labelled text
 * Button is never made round (it turns into an ellipse).
 */
export function CallRoundButton({
  icon,
  label,
  tone = 'neutral',
  size = 'md',
  className,
  ...rest
}: CallRoundButtonProps) {
  return (
    <button
      type="button"
      className={['uicall-rb', `uicall-rb--${tone}`, `uicall-rb--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className="uicall-rb-c">
        <Icon name={icon} />
      </span>
      <span className="uicall-rb-l">{label}</span>
    </button>
  );
}
