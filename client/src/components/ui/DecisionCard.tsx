import type { ReactNode } from 'react';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { StatTile } from './StatTile';
import { Tag } from './Tag';
import type { Tone } from './tones';
import './DecisionCard.css';

export interface DecisionTag {
  label: string;
  tone?: Tone;
}

export interface DecisionCardProps {
  clientName: string;
  /** The face (40px). Default: the kit initials disc; Coach passes the app Avatar. */
  avatar?: ReactNode;
  /** "Upper/Lower 4× · week 6" */
  clientSub?: string;
  /** Text action, never a decision option ("Message Oleh"). */
  messageLabel: string;
  onMessage?: () => void;
  tags?: DecisionTag[];
  title: string;
  body?: string;
  /** Big number block left of the chart. */
  hero?: { label: string; value: string; unit?: string; sub?: string };
  /** An `EvidenceChart` (compact). */
  chart?: ReactNode;
  /** The suggested option as the one filled primary. */
  primary?: { label: string; onClick: () => void; busy?: boolean };
  /** One line under the primary: what it changes and when it is checked. */
  effect?: string;
  /** Text links: "See evidence and options", "2 other options". */
  evidence?: { label: string; onClick: () => void };
  others?: { label: string; expanded: boolean; onClick: () => void };
  /** Rendered under the links when `others.expanded`. */
  othersPanel?: ReactNode;
  /** Heading level of the title (the page owns h1). */
  headingLevel?: 2 | 3;
  /** A pinned heading id for aria-labelledby on the card. */
  id?: string;
  className?: string;
}

/**
 * The decision preview card (C-15, Today detail pane and board drawer): who, tags, what happened in
 * plain words, the number + evidence chart, and ONE filled primary (the suggested option). Everything
 * else is text: "See evidence and options", "N other options", "Message <name>".
 */
export function DecisionCard({
  clientName,
  avatar,
  clientSub,
  messageLabel,
  onMessage,
  tags,
  title,
  body,
  hero,
  chart,
  primary,
  effect,
  evidence,
  others,
  othersPanel,
  headingLevel = 2,
  id,
  className,
}: DecisionCardProps) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <Card
      as="section"
      pad="lg"
      className={['uidc', className].filter(Boolean).join(' ')}
      aria-labelledby={id ? `${id}-title` : undefined}
      id={id}
    >
      <div className="uidc-who">
        {avatar ?? <Avatar name={clientName} size={40} />}
        <div className="uidc-who-t">
          <div className="uidc-name">{clientName}</div>
          {clientSub && <div className="uidc-sub">{clientSub}</div>}
        </div>
        <Button variant="ghost" size="sm" icon="envelope" onClick={onMessage} className="uidc-msg">
          {messageLabel}
        </Button>
      </div>
      {tags && tags.length > 0 && (
        <ul className="uidc-tags">
          {tags.map((t) => (
            <li key={t.label}>
              <Tag tone={t.tone ?? 'neutral'}>{t.label}</Tag>
            </li>
          ))}
        </ul>
      )}
      <H className="uidc-title" id={id ? `${id}-title` : undefined}>
        {title}
      </H>
      {body && <p className="uidc-body">{body}</p>}
      {(hero || chart) && (
        <div className="uidc-evid">
          {hero && (
            <StatTile big label={hero.label} value={hero.value} unit={hero.unit} sub={hero.sub} />
          )}
          {chart && <div className="uidc-chart">{chart}</div>}
        </div>
      )}
      {primary && (
        <div className="uidc-act">
          <Button variant="fill" onClick={primary.onClick} loading={primary.busy}>
            {primary.label}
          </Button>
          {effect && <p className="uidc-effect">{effect}</p>}
        </div>
      )}
      {(evidence || others) && (
        <div className="uidc-links">
          {evidence && (
            <Button variant="link" iconTrailing="arrow-right" onClick={evidence.onClick}>
              {evidence.label}
            </Button>
          )}
          {others && (
            <Button
              variant="link"
              iconTrailing={others.expanded ? 'caret-up' : 'caret-down'}
              onClick={others.onClick}
              aria-expanded={others.expanded}
            >
              {others.label}
            </Button>
          )}
        </div>
      )}
      {others?.expanded && othersPanel}
    </Card>
  );
}
