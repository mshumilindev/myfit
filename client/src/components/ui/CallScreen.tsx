import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { IconButton } from './Button';
import './Call.css';

export interface CallScreenProps {
  /** Other person's name and the line under it ("Calling…", "12:41", "Reconnecting…"). */
  name: string;
  status: ReactNode;
  /** Small trust line under the header ("Not recorded"). */
  note?: ReactNode;
  /** The stage: the remote `CallTile` (and your own `self` tile). */
  children: ReactNode;
  /** A `Notice` between the header and the stage (weak connection, reconnecting). */
  notice?: ReactNode;
  /** The `CallControls` row (or the end button alone while ringing). */
  foot: ReactNode;
  onMinimize?: () => void;
  minimizeLabel?: string;
  /** Lets the page behind the call stay readable on desktop: the call is a panel, not the whole screen. */
  panel?: boolean;
}

/**
 * The call frame (kit group `Call`): on a phone the whole screen (header, stage that takes the rest, controls with the
 * safe area), from 720 px a panel card over the app. The stage is a slot so the same frame draws ringing, connecting,
 * live, reconnecting and ended.
 */
export function CallScreen({
  name,
  status,
  note,
  children,
  notice,
  foot,
  onMinimize,
  minimizeLabel,
  panel,
}: CallScreenProps) {
  return (
    <section className={panel ? 'uicall uicall--panel' : 'uicall'} aria-label={name}>
      <header className="uicall-head">
        {onMinimize && (
          <IconButton
            icon="arrows-in-simple"
            label={minimizeLabel ?? ''}
            variant="ghost"
            onClick={onMinimize}
          />
        )}
        <div className="uicall-who">
          <b>{name}</b>
          <small aria-live="polite">{status}</small>
        </div>
        {note && (
          <span className="uicall-note">
            <Icon name="lock-simple" />
            {note}
          </span>
        )}
      </header>
      {notice && <div className="uicall-notice">{notice}</div>}
      <div className="uicall-stage">{children}</div>
      <footer className="uicall-foot">{foot}</footer>
    </section>
  );
}
