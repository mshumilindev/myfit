import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Avatar } from './Avatar';
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
  /** Corner chip over the picture (connection quality). */
  corner?: ReactNode;
  className?: string;
}

/**
 * One person in a call (kit group `Call`): a live picture, or the avatar on a glass plate while the camera is off,
 * with the name plate (and a crossed mic) at the foot. The remote tile fills the stage; your own is the small `self` one.
 */
export function CallTile({ name, photo, video, micOff, self, corner, className }: CallTileProps) {
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
          <Avatar name={name} src={photo} size={self ? 56 : 112} />
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
