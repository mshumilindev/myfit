import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { ListRow } from './GroupedList';
import { SeverityDot } from './SeverityDot';
import { Tag } from './Tag';
import type { Tone } from './tones';
import './RosterRows.css';

/**
 * Coach roster pieces (story group `Coach/Roster rows`). Plain strings in, no dictionary, no domain imports:
 * Roster, Signals, Client 360 and Today can all draw the same row.
 */

export type RowStatus = 'urgent' | 'watch' | 'good' | 'none';
const STATUS_TONE: Record<RowStatus, Tone> = {
  urgent: 'danger',
  watch: 'illness',
  good: 'ok',
  none: 'neutral',
};

/** Dot + word. The word carries the meaning, the colour only helps (never colour alone). */
export function StatusLabel({ status, children }: { status: RowStatus; children: ReactNode }) {
  return (
    <SeverityDot tone={STATUS_TONE[status]} dot={status !== 'none'}>
      {children}
    </SeverityDot>
  );
}

export type LogModeKind = 'app' | 'hybrid' | 'program';
const MODE_ICON: Record<LogModeKind, string> = {
  app: 'device-mobile',
  hybrid: 'swap',
  program: 'list-checks',
};

/** How the client logs: App / Hybrid / Program only. Icon + word. */
export function LogModeBadge({ mode, children }: { mode: LogModeKind; children: ReactNode }) {
  return (
    <Tag tone="neutral" icon={<Icon name={MODE_ICON[mode]} />}>
      {children}
    </Tag>
  );
}

export interface ClientRowProps {
  name: string;
  /** The face (40px). Default: the kit initials disc; Coach passes the app Avatar. */
  avatar?: ReactNode;
  /** Program line under the name (or the invite state for a pending row). */
  program: string;
  /** "1 of 4": this week, right column. Omit for pending rows. */
  weekLabel?: string;
  status?: RowStatus;
  statusLabel?: string;
  /** Open signals (shown as a neutral count badge when more than the status already says). */
  signalCount?: number;
  signalLabel?: string;
  /** Right column text for rows without a status (pending invite, "Added"). */
  trailing?: ReactNode;
  logMode?: { mode: LogModeKind; label: string };
  selected?: boolean;
  /** Unread chat messages from this client. */
  unread?: number;
  unreadLabel?: string;
  onClick?: () => void;
  /** Full spoken name; default is built from the visible parts. */
  ariaLabel?: string;
}

/**
 * One client in a list: a kit `ListRow` (avatar, bold name, program line, trailing column).
 * A button when it has `onClick`. Put rows in a `GroupedList list`.
 */
export function ClientRow({
  name,
  avatar,
  program,
  weekLabel,
  status,
  statusLabel,
  signalCount = 0,
  signalLabel,
  trailing,
  logMode,
  selected,
  unread = 0,
  unreadLabel,
  onClick,
  ariaLabel,
}: ClientRowProps) {
  return (
    <ListRow
      className="ros-row"
      icon={avatar ?? <Avatar name={name} size={40} />}
      strong
      label={name}
      sub={
        <span className="ros-row-s">
          <span>{program}</span>
          {logMode && logMode.mode !== 'app' && (
            <LogModeBadge mode={logMode.mode}>{logMode.label}</LogModeBadge>
          )}
        </span>
      }
      trailing={
        <>
          <span className="ros-row-r">
            {weekLabel != null && <small>{weekLabel}</small>}
            {status && statusLabel != null && (
              <StatusLabel status={status}>{statusLabel}</StatusLabel>
            )}
            {trailing}
          </span>
          {signalCount > 1 && (
            <span className="ros-row-c" aria-label={signalLabel}>
              <Badge n={signalCount} tone="neutral" label={signalLabel ? undefined : ''} />
            </span>
          )}
          {unread > 0 && (
            <span className="ros-row-c" role="img" aria-label={unreadLabel}>
              <Badge n={unread} tone="danger" />
            </span>
          )}
        </>
      }
      selected={selected}
      aria-current={onClick && selected ? 'true' : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      onClick={onClick}
    />
  );
}

export interface SignalListRowProps {
  title: string;
  clientName: string;
  /** The face (40px). Default: the kit initials disc. */
  avatar?: ReactNode;
  severity: Exclude<RowStatus, 'none'>;
  severityLabel: string;
  /** "Stall", "Injury"... */
  kindLabel: string;
  /** "today", "2 days" */
  ageLabel: string;
  /** "Decided": shown as a pill after the meta. */
  decidedLabel?: string;
  selected?: boolean;
  onClick: () => void;
}

/** One signal in the All signals list: a kit `ListRow`. Title wraps to two lines; meta wraps. */
export function SignalListRow({
  title,
  clientName,
  avatar,
  severity,
  severityLabel,
  kindLabel,
  ageLabel,
  decidedLabel,
  selected,
  onClick,
}: SignalListRowProps) {
  return (
    <ListRow
      className="ros-row ros-sig"
      icon={avatar ?? <Avatar name={clientName} size={40} />}
      strong
      label={title}
      sub={
        <span className="ros-sig-m">
          <StatusLabel status={severity}>{severityLabel}</StatusLabel>
          <span>{clientName}</span>
          <span>{kindLabel}</span>
          <span>{ageLabel}</span>
          {decidedLabel && <Tag tone="neutral">{decidedLabel}</Tag>}
        </span>
      }
      selected={selected}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
    />
  );
}

/**
 * A row-sized note for a category the client does not share: lock + sentence. Never shows data.
 * `inline` is for a value cell (InfoTable `dd`): lock and text hug each other as one element at the end of the
 * cell, instead of the lock sitting at the left edge of the cell and the text flushed to the far right.
 */
export function LockedRow({
  children,
  action,
  inline,
}: {
  children: ReactNode;
  action?: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={['ros-locked', inline && 'ros-locked-inline'].filter(Boolean).join(' ')}>
      <Icon name="lock-simple" className="ros-locked-i" />
      <span className="ros-locked-t">{children}</span>
      {action}
    </div>
  );
}
