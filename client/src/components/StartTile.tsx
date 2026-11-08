import type { ComponentProps } from 'react';
import { Card } from './ui/Card';
import { IconTile } from './ui/IconTile';
import { Icon } from '../ui';

type Tone = ComponentProps<typeof IconTile>['tone'];

/**
 * One tile of the Start sheet. A tile that starts something (`lockable`) goes dark with a lock while a workout, activity
 * or sleep is running and says what to finish first (`lockedSub`); the others (Health, Sleep, Log past, Programs) stay open.
 */
export function StartTile({
  tone,
  icon,
  title,
  sub,
  onClick,
  lockable,
  locked = false,
  lockedSub,
}: {
  tone: Tone;
  icon: string;
  title: string;
  sub: string;
  onClick: () => void;
  lockable?: boolean;
  locked?: boolean;
  lockedSub?: string;
}) {
  const lock = !!lockable && locked;
  const tile = <IconTile tone={tone} size={40} icon={icon} className="ss-ic" />;
  return (
    <Card
      as="button"
      className={`ss-tile${lock ? ' locked' : ''}`}
      {...(lockable ? { 'aria-disabled': lock } : {})}
      onClick={lock ? undefined : onClick}
    >
      {lockable ? (
        <span className="ss-tile-top">
          {tile}
          {lock && <Icon name="lock-simple" className="ss-lock" />}
        </span>
      ) : (
        tile
      )}
      <span className="ss-tile-text">
        <span className="ss-tt">{title}</span>
        <span className="ss-ts">{lock ? lockedSub : sub}</span>
      </span>
    </Card>
  );
}
