import { Icon } from '../../ui';
import { Button } from './Button';
import { Card } from './Card';
import { IconTile } from './IconTile';
import { Tag } from './Tag';
import './RequestCard.css';

export interface RequestCardProps {
  title: string;
  /** "Needs your answer" / "Waiting for Maria". */
  status: string;
  /** `answer` = the trainer must answer; `waiting` = the trainer asked, the client has not. */
  kind: 'answer' | 'waiting';
  fromLabel: string;
  from: string;
  toLabel: string;
  to: string;
  /** The client's note, quoted. */
  note?: string;
  accept?: { label: string; ariaLabel: string; onClick: () => void };
  decline?: { label: string; ariaLabel: string; onClick: () => void };
  propose?: { label: string; ariaLabel: string; onClick: () => void };
  cancel?: { label: string; ariaLabel: string; onClick: () => void };
  /** Disables the buttons while an answer is being sent. */
  busy?: boolean;
  /** After answering: a quiet line instead of the buttons (role="status"). */
  resultText?: string;
  /** An error line under the buttons. */
  errorText?: string;
  /** Inside another card: no frame, no padding. */
  flat?: boolean;
  className?: string;
}

/**
 * Reschedule request card (Today and Client 360). Flat card: who asks, From -> To, the note, and the
 * three answers Accept / Decline / Propose another (or Cancel request for one you sent). The screen
 * decides what happens (callbacks); this only draws it.
 */
export function RequestCard({
  title,
  status,
  kind,
  fromLabel,
  from,
  toLabel,
  to,
  note,
  accept,
  decline,
  propose,
  cancel,
  busy,
  resultText,
  errorText,
  flat,
  className,
}: RequestCardProps) {
  return (
    <Card
      as="section"
      pad={flat ? 'none' : 'md'}
      emphasis={flat ? 'quiet' : undefined}
      className={['uirq', className].filter(Boolean).join(' ')}
    >
      <div className="uirq-head">
        <IconTile icon="calendar-blank" size={40} />
        <div className="uirq-head-t">
          <h2 className="uirq-title">{title}</h2>
        </div>
        <Tag tone="accent" icon={<Icon name="hourglass" />}>
          {status}
        </Tag>
      </div>
      <div className="uirq-move">
        <div>
          <div className="uirq-l">{fromLabel}</div>
          <div className="uirq-v">{from}</div>
        </div>
        <Icon name="arrow-right" className="uirq-arrow" />
        <div>
          <div className="uirq-l">{toLabel}</div>
          <div className="uirq-v">{to}</div>
        </div>
      </div>
      {note && <blockquote className="uirq-note">“{note}”</blockquote>}
      {resultText ? (
        <p className="uirq-result" role="status">
          {resultText}
        </p>
      ) : (
        <div className="uirq-acts ctl-row--md">
          {kind === 'answer' && accept && (
            <Button
              variant="secondary"
              icon="check"
              onClick={accept.onClick}
              aria-label={accept.ariaLabel}
              disabled={busy}
            >
              {accept.label}
            </Button>
          )}
          {kind === 'answer' && decline && (
            <Button
              variant="secondary"
              onClick={decline.onClick}
              aria-label={decline.ariaLabel}
              disabled={busy}
            >
              {decline.label}
            </Button>
          )}
          {kind === 'answer' && propose && (
            <Button
              variant="link"
              onClick={propose.onClick}
              aria-label={propose.ariaLabel}
              disabled={busy}
            >
              {propose.label}
            </Button>
          )}
          {kind === 'waiting' && cancel && (
            <Button
              variant="link"
              onClick={cancel.onClick}
              aria-label={cancel.ariaLabel}
              disabled={busy}
            >
              {cancel.label}
            </Button>
          )}
        </div>
      )}
      {errorText && (
        <p className="uirq-error" role="alert">
          {errorText}
        </p>
      )}
    </Card>
  );
}
