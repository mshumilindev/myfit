import { useRef, useState, type ReactNode } from 'react';
import { Avatar } from './Avatar';
import { Popover } from './Popover';
import { Chip } from './Chip';
import { GroupedList, ListRow } from './GroupedList';
import { SectionLabel } from './SectionLabel';
import { SeverityDot } from './SeverityDot';
import type { Tone } from './tones';
import './LiveWidget.css';

export type LiveStatus = 'live' | 'offline' | 'finished';

export interface LiveEntry {
  id: string;
  name: string;
  status: LiveStatus;
  /** One short line: "Iron Yard · since 08:51". */
  detail: string;
  /** Right column, one line with the status dot: "14 min" (finished: the clock time it ended). */
  metric: string;
  /** What the status dot means ("Training now", "Last seen 3 min ago", "Finished"): its tooltip and the row's spoken name. */
  statusText: string;
  /** The face (40px). Default: the kit initials disc; Coach passes the app Avatar. */
  avatar?: ReactNode;
  /** Opens this client's live page; the widget closes first. Without it the row is plain text. */
  onOpen?: () => void;
  /** Accessible name of a clickable row ("Maria Tkach, training now, 14 min"). */
  ariaLabel?: string;
}

export interface LiveWidgetProps {
  entries: LiveEntry[];
  /** Pill text ("1 live"). */
  pillLabel: string;
  pillAria: string;
  title: string;
  summary: string;
  groupLabels: Record<LiveStatus, string>;
  /** Shown when there are no entries. */
  noneText: string;
  privacy: string;
  /** Start with the list open (stories, tests). */
  defaultOpen?: boolean;
  className?: string;
}

const STATUS_TONE: Record<LiveStatus, Tone> = {
  live: 'ok',
  offline: 'illness',
  finished: 'neutral',
};

/**
 * "N live" widget (C-21): a pill that opens the list of clients training now (live), who
 * lost connection (offline, static "last seen", no running clock) and who just finished. It shows who
 * and for how long, never sets or weights. Rows are kit ListRows on the popover's own surface (flat list: no
 * card inside the card); a row is a button only when it navigates, and then it has no chevron, the hover is the cue.
 */
export function LiveWidget({
  entries,
  pillLabel,
  pillAria,
  title,
  summary,
  groupLabels,
  noneText,
  privacy,
  defaultOpen = false,
  className,
}: LiveWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLSpanElement>(null);
  const groups: LiveStatus[] = ['live', 'offline', 'finished'];
  return (
    <span ref={ref} className={['uilivew', className].filter(Boolean).join(' ')}>
      <Chip
        tone="ok"
        icon={entries.some((e) => e.status === 'live') ? 'circle' : undefined}
        onClick={() => setOpen((o) => !o)}
        aria-label={pillAria}
        aria-pressed={undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {pillLabel}
      </Chip>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        label={title}
        side="bottom"
        align="end"
        width={400}
      >
        <div className="uilivew-panel">
          <h2 className="uilivew-title">{title}</h2>
          <p className="uilivew-sum">{summary}</p>
          {entries.length === 0 && <p className="uilivew-none">{noneText}</p>}
          {groups.map((g) => {
            const list = entries.filter((e) => e.status === g);
            if (!list.length) return null;
            return (
              <section key={g} className="uilivew-grp">
                <div className="uilivew-hd">
                  <SectionLabel role="heading" aria-level={3}>
                    {groupLabels[g]}
                  </SectionLabel>
                </div>
                <GroupedList list surface="flat" label={groupLabels[g]}>
                  {list.map((e) => (
                    <li key={e.id}>
                      <ListRow
                        icon={e.avatar ?? <Avatar name={e.name} size={40} />}
                        strong
                        label={e.name}
                        sub={e.detail}
                        aria-label={e.onOpen ? e.ariaLabel : undefined}
                        onClick={
                          e.onOpen
                            ? () => {
                                setOpen(false);
                                e.onOpen?.();
                              }
                            : undefined
                        }
                        value={
                          <SeverityDot
                            tone={STATUS_TONE[e.status]}
                            className="uilivew-m"
                            title={e.statusText}
                          >
                            {e.metric}
                          </SeverityDot>
                        }
                      />
                    </li>
                  ))}
                </GroupedList>
              </section>
            );
          })}
          <p className="uilivew-priv">{privacy}</p>
        </div>
      </Popover>
    </span>
  );
}
