import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Avatar } from './Avatar';
import { CallRings } from './CallRings';
import { CallWave } from './CallWave';
import './Call.css';

export interface CallTileProps {
  /** The person shown (name on the plate, initials when there is no photo). */
  name: string;
  /** Profile photo for the avatar shown while the camera is off. */
  photo?: string | null;
  /** The live picture (a `<video>`); omit while the camera is off, the avatar is drawn instead. */
  video?: ReactNode;
  /** Mic is off: a crossed mic on the name plate. */
  micOff?: boolean;
  /** Your own preview: small, mirrored, floats over the other person. */
  self?: boolean;
  /** The floating mini window: a small avatar so it fits the tile. */
  small?: boolean;
  /** The phone is ringing: the avatar gets ripples (outgoing call). */
  ringing?: boolean;
  /** Voice-only call: voice bars under the avatar. */
  wave?: boolean;
  /** With `wave`: the live voice level 0..1 (see `CallWave`). */
  waveLevel?: number;
  wavePhase?: number;
  /** Corner chip over the picture (connection quality). */
  corner?: ReactNode;
  className?: string;
}

/**
 * One person in a call (kit group `Call`): a live picture, or the avatar on a glass plate while the camera is off,
 * with the name plate (and a crossed mic) at the foot. The remote tile fills the stage; your own is the small `self` one.
 */
export function CallTile({
  name,
  photo,
  video,
  micOff,
  self,
  small,
  ringing,
  wave,
  waveLevel,
  wavePhase,
  corner,
  className,
}: CallTileProps) {
  const cls = [
    'uicall-tile',
    self ? 'uicall-tile--self' : '',
    video ? 'uicall-tile--video' : 'uicall-tile--off',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      {video ? (
        <div className="uicall-media">{video}</div>
      ) : (
        <div className="uicall-ph">
          {self || small ? (
            <Avatar name={name} src={photo} size={56} />
          ) : (
            <CallRings name={name} photo={photo} size={112} ringing={!!ringing} />
          )}
          {wave && !self && !small && <CallWave level={waveLevel} phase={wavePhase} />}
        </div>
      )}
      {corner && <div className="uicall-corner">{corner}</div>}
      <div className="uicall-plate">
        {micOff && <Icon name="microphone-slash" />}
        <span className="uicall-plate-n">{name}</span>
      </div>
    </div>
  );
}
