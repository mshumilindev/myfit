import { Icon } from '../../ui';
import { IconButton } from './Button';
import { CallTile, type CallTileProps } from './CallTile';
import './Call.css';

export interface CallMiniProps extends Pick<CallTileProps, 'name' | 'photo' | 'video'> {
  time: string;
  expandLabel: string;
  endLabel: string;
  onExpand: () => void;
  onEnd: () => void;
}

/**
 * The call shrunk to a floating tile (kit group `Call`), for when the person opens a screen that needs the whole page
 * (logging a set in a session). Tapping the picture expands the call; the red button hangs up. It keeps clear of the
 * tab bar and the composer (the host sets its offset).
 */
export function CallMini({
  name,
  photo,
  video,
  time,
  expandLabel,
  endLabel,
  onExpand,
  onEnd,
}: CallMiniProps) {
  return (
    <div className="uicall-mini">
      <button
        type="button"
        className="uicall-mini-tile"
        onClick={onExpand}
        aria-label={`${expandLabel}: ${name}`}
      >
        <CallTile name={name} photo={photo} video={video} />
        <span className="uicall-mini-time">
          <Icon name="arrows-out-simple" />
          {time}
        </span>
      </button>
      <IconButton
        icon="phone-disconnect"
        label={endLabel}
        variant="danger"
        shape="round"
        size="sm"
        className="uicall-mini-end"
        onClick={onEnd}
      />
    </div>
  );
}
