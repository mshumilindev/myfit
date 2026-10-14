import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { Chip, type ChipTone } from './Chip';
import { IconTile } from './IconTile';
import { ProgressBar } from './ProgressBar';
import './DecisionRecord.css';

export interface DecisionRecordStep {
  id: string;
  icon: string;
  title: string;
  body: ReactNode;
}

export interface DecisionRecordFollowUp {
  title: string;
  /** "Closed" or "Day 4 of 14". */
  status: string;
  /** 0-100. */
  value: number;
  tone: 'ok' | 'accent';
  progressLabel: string;
  /** Quiet lines under the bar (what was measured, the one threshold). */
  notes: readonly string[];
}

export interface DecisionRecordProps {
  /** Person block: avatar node, name, "Upper/Lower 4x · decided 16 Sep". */
  avatar: ReactNode;
  name: string;
  sub: string;
  /** Opens the client (the name becomes a button). */
  onOpenClient?: () => void;
  result: { label: string; tone: ChipTone; icon?: string };
  /** Spoken name of the steps list. */
  stepsLabel: string;
  steps: readonly DecisionRecordStep[];
  followUp?: DecisionRecordFollowUp;
  actions?: ReactNode;
  /** "Oleh sees the decision and its result, never your private notes." */
  footnote?: string;
  className?: string;
}

/**
 * Decision record (S-19): who, the outcome pill, the four-step chain (What happened, Evidence, Decision,
 * Result), the follow-up window and the actions. Presentational and flat: it sits inside an Inspector or a
 * list row, so it draws no plate of its own.
 */
export function DecisionRecord({
  avatar,
  name,
  sub,
  onOpenClient,
  result,
  stepsLabel,
  steps,
  followUp,
  actions,
  footnote,
  className,
}: DecisionRecordProps) {
  const who = (
    <>
      <span className="drec-n">{name}</span>
      <span className="drec-s">{sub}</span>
    </>
  );
  return (
    <div className={['drec', className].filter(Boolean).join(' ')}>
      <header className="drec-h">
        {avatar}
        {onOpenClient ? (
          <button type="button" className="drec-who is-link" onClick={onOpenClient}>
            {who}
          </button>
        ) : (
          <span className="drec-who">{who}</span>
        )}
        <Chip tone={result.tone} icon={result.icon}>
          {result.label}
        </Chip>
      </header>
      <ol className="drec-steps" aria-label={stepsLabel}>
        {steps.map((s) => (
          <li key={s.id} className="drec-step">
            <IconTile icon={s.icon} size={30} />
            <span className="drec-st">
              <span className="drec-sk">{s.title}</span>
              <span className="drec-sb">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      {followUp && (
        <section className="drec-fu" aria-label={followUp.title}>
          <div className="drec-fu-h">
            <span>{followUp.title}</span>
            <b>{followUp.status}</b>
          </div>
          <ProgressBar value={followUp.value} tone={followUp.tone} label={followUp.progressLabel} />
          {followUp.notes.map((n) => (
            <p key={n} className="drec-note">
              {n}
            </p>
          ))}
        </section>
      )}
      {actions && <div className="drec-a">{actions}</div>}
      {footnote && (
        <p className="drec-foot">
          <Icon name="lock-simple" />
          <span>{footnote}</span>
        </p>
      )}
    </div>
  );
}
