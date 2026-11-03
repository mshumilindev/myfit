import { Avatar } from './Avatar';
import './Call.css';

export interface CallRingsProps {
  name: string;
  photo?: string | null;
  size?: number;
  /** Ripples go out while the phone rings; false draws the still rings (reduced motion always does). */
  ringing?: boolean;
}

/**
 * The avatar with call ripples around it (kit group `Call`): the picture of "ringing" for an outgoing call, an incoming
 * one and a voice-only call. The ripples are CSS only and stop under reduced motion.
 */
export function CallRings({ name, photo, size = 120, ringing = true }: CallRingsProps) {
  return (
    <span className={ringing ? 'uicall-rings uicall-rings--on' : 'uicall-rings'}>
      <span className="uicall-rings-r" aria-hidden="true" />
      <span className="uicall-rings-r uicall-rings-r--2" aria-hidden="true" />
      <span className="uicall-rings-r uicall-rings-r--3" aria-hidden="true" />
      <Avatar name={name} src={photo} size={size} />
    </span>
  );
}
