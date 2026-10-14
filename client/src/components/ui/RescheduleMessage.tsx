import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Button } from './Button';
import { Card } from './Card';
import { Tag } from './Tag';
import type { Tone } from './tones';
import './RescheduleMessage.css';

export type RescheduleMessageStatus =
  'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'countered';

const STATUS_ICON: Record<RescheduleMessageStatus, string> = {
  pending: 'clock-countdown',
  accepted: 'check-circle',
  declined: 'x-circle',
  expired: 'minus-circle',
  cancelled: 'minus-circle',
  countered: 'arrows-clockwise',
};
const STATUS_TONE: Record<RescheduleMessageStatus, Tone> = {
  pending: 'accent',
  accepted: 'ok',
  declined: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
  countered: 'rest',
};

export interface RescheduleMessageAction {
  label: string;
  /** Spoken name when the label alone is ambiguous. */
  ariaLabel?: string;
  icon?: string;
  onClick: () => void;
}

export interface RescheduleMessageProps {
  status: RescheduleMessageStatus;
  /** "Reschedule request". */
  kindLabel: string;
  /** "Pending" / "Accepted" ... (icon + word, never colour alone). */
  statusLabel: string;
  /** "You asked Oleh to move a session". */
  title: string;
  /** Which session: bold part, then the quiet rest ("5 people . 60 min . Iron Yard"). */
  session: { bold: string; rest?: string; icon?: string };
  /** The old and the new time: `Now` / `Was` and `Proposed` / `Now` labels, day and clock. */
  from: { label: string; day: string; time: string; struck?: boolean };
  to: { label: string; day: string; time: string };
  /** The note (encrypted, quoted with a lock). */
  note?: string;
  /** Pending, the viewer must answer. */
  accept?: RescheduleMessageAction;
  decline?: RescheduleMessageAction;
  counter?: RescheduleMessageAction;
  /** Pending, the viewer asked: "Waiting for Oleh. ..." and Cancel request. */
  waiting?: { text: string; cancel?: RescheduleMessageAction };
  /** After the answer: what happened, and when. */
  outcome?: { text: string; when?: string };
  /** "Propose a new time" / "Open calendar" under the outcome. */
  followUp?: RescheduleMessageAction;
  /** Disables the buttons while an answer is sent. */
  busy?: boolean;
  /** Under the buttons. */
  errorText?: string;
  /** The viewer's own request sits on the right in a thread. */
  mine?: boolean;
  /** Extra content (the trainer-only group summary is its own card, not here). */
  children?: ReactNode;
  className?: string;
}

/**
 * The reschedule request card inside a chat bubble (kit group `Coach/Reschedule card`). Presentational: every word is a
 * prop, so the trainer chat, the client chat and the dock draw the same card. It says WHICH session, old -> new time,
 * the note and the status (icon + word). The person who has to answer gets Accept / Decline / Suggest another time; the
 * person who asked gets Cancel request. The card is a live view: the owner passes the current status.
 */
export function RescheduleMessage(p: RescheduleMessageProps) {
  const cls = ['uirm', `is-${p.status}`, p.mine ? 'is-mine' : 'is-theirs', p.className]
    .filter(Boolean)
    .join(' ');
  const act = (a: RescheduleMessageAction, variant: 'primary' | 'secondary' | 'link') => (
    <Button
      key={a.label}
      size="sm"
      variant={variant}
      icon={a.icon}
      disabled={p.busy}
      aria-label={a.ariaLabel}
      onClick={a.onClick}
    >
      {a.label}
    </Button>
  );
  return (
    <Card
      className={cls}
      pad="md"
      tone={p.status === 'declined' ? 'danger' : p.status === 'accepted' ? 'ok' : 'neutral'}
      role="group"
      aria-label={`${p.kindLabel}, ${p.statusLabel}`}
      data-status={p.status}
    >
      <header className="uirm-h">
        <span className="uirm-kind">
          <Icon name="calendar-dots" />
          {p.kindLabel}
        </span>
        <Tag tone={STATUS_TONE[p.status]} icon={<Icon name={STATUS_ICON[p.status]} />}>
          {p.statusLabel}
        </Tag>
      </header>
      <p className="uirm-t">{p.title}</p>
      <p className="uirm-s">
        <Icon name={p.session.icon ?? 'calendar-check'} />
        <span>
          <b>{p.session.bold}</b>
          {p.session.rest}
        </span>
      </p>
      <div className="uirm-mv">
        <div className={`uirm-d is-old${p.from.struck ? ' is-struck' : ''}`}>
          <small>{p.from.label}</small>
          <b>{p.from.day}</b>
          <span>{p.from.time}</span>
        </div>
        <Icon name="arrow-right" className="uirm-ar" />
        <div className="uirm-d is-new">
          <small>{p.to.label}</small>
          <b>{p.to.day}</b>
          <span>{p.to.time}</span>
        </div>
      </div>
      {p.note && (
        <p className="uirm-n">
          <Icon name="lock-simple" />
          <span>{p.note}</span>
        </p>
      )}
      {p.status === 'pending' && p.accept && (
        <div className="uirm-a ctl-row--sm">
          {act(p.accept, 'primary')}
          {p.decline && act(p.decline, 'secondary')}
          {p.counter && act(p.counter, 'link')}
        </div>
      )}
      {p.status === 'pending' && p.waiting && (
        <div className="uirm-w">
          <span>{p.waiting.text}</span>
          {p.waiting.cancel && act(p.waiting.cancel, 'secondary')}
        </div>
      )}
      {p.errorText && (
        <p className="uirm-err" role="alert">
          {p.errorText}
        </p>
      )}
      {p.status !== 'pending' && p.outcome && (
        <p className="uirm-o">
          {p.outcome.text}
          {p.outcome.when && <small>{p.outcome.when}</small>}
        </p>
      )}
      {p.status !== 'pending' && p.followUp && (
        <div className="uirm-a ctl-row--sm">{act(p.followUp, 'link')}</div>
      )}
      {p.children}
    </Card>
  );
}
