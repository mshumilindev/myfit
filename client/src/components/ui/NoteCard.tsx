import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { Card } from './Card';
import { Tag } from './Tag';
import './NoteCard.css';

export interface NoteCardProps {
  /** Who can read it: the tag is brass for a shared note, neutral for a private one. */
  vis: 'private' | 'shared';
  /** "Private", "Shared with Oleh", "From Iryna". */
  visLabel: string;
  /** "Today 08:40" plus the edited marker, already formatted. */
  time: string;
  text: string;
  /** What the note hangs on: a chip-like line. A function makes it a button ("Jump to message"). */
  context?: { icon: string; label: string; onOpen?: () => void; actionLabel?: string };
  /** Edit form replaces the text. */
  editing?: ReactNode;
  /** Buttons under the note (trainer side). Absent on the client side: read-only. */
  actions?: ReactNode;
  /** The row just jumped to. */
  highlighted?: boolean;
  /** Collapse to this many lines until tapped. Default 3. */
  lines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
}

/**
 * One note (kit group `Coach/Note card`), used by the Notes panel, the Client 360 Notes tab and the client's read-only
 * list. Presentational: every word is a prop. Text is a text node (never HTML). Long notes fold to three lines and the
 * text itself is the toggle.
 */
export function NoteCard(p: NoteCardProps) {
  const [open, setOpen] = useState(false);
  const long = p.text.length > 140 || p.text.includes('\n');
  const cls = [
    'uinote',
    p.vis === 'shared' ? 'is-shared' : 'is-private',
    p.highlighted ? 'is-hl' : '',
    p.className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Card as="div" tone={p.vis === 'shared' ? 'note' : 'neutral'} pad="md" className={cls}>
      <div className="uinote-h">
        <Tag
          tone={p.vis === 'shared' ? 'note' : 'neutral'}
          icon={<Icon name={p.vis === 'shared' ? 'eye' : 'lock-simple'} />}
        >
          {p.visLabel}
        </Tag>
        <time className="uinote-time">{p.time}</time>
      </div>
      {p.editing ? (
        p.editing
      ) : long && p.expandLabel ? (
        <button
          type="button"
          className={`uinote-t uinote-t--btn${open ? ' is-open' : ''}`}
          style={open ? undefined : ({ '--uinote-lines': p.lines ?? 3 } as CSSProperties)}
          aria-expanded={open}
          aria-label={open ? p.collapseLabel : p.expandLabel}
          onClick={() => setOpen(!open)}
        >
          {p.text}
        </button>
      ) : (
        <p className="uinote-t">{p.text}</p>
      )}
      {p.context &&
        (p.context.onOpen ? (
          <button
            type="button"
            className="uinote-ctx"
            onClick={p.context.onOpen}
            aria-label={`${p.context.label}. ${p.context.actionLabel ?? ''}`.trim()}
          >
            <Icon name={p.context.icon} />
            <span>{p.context.label}</span>
            <Icon name="arrow-up-right" />
          </button>
        ) : (
          <span className="uinote-ctx is-static">
            <Icon name={p.context.icon} />
            <span>{p.context.label}</span>
          </span>
        ))}
      {p.actions && !p.editing && <div className="uinote-act">{p.actions}</div>}
    </Card>
  );
}
