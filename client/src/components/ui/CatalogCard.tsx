import type { ReactNode, MouseEventHandler } from 'react';
import { Icon } from '../../ui';
import { Card } from './Card';
import { Tag } from './Tag';
import './CatalogCard.css';

export interface CatalogCardProps {
  /** Who the program is by (athlete name): the accent line on top. */
  who: string;
  /** Program title. */
  title: string;
  /** One line of facts ("3 days · 12 weeks · ~60 min · Beginner"). */
  meta: string;
  /** Present when the item cannot be started yet: shown as a quiet "Needs …" tag and the text is dimmed. */
  lockedLabel?: ReactNode;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
}

/**
 * One program in a browsable catalog (kit `catalog-card`): a whole-card button with the
 * author first, the title, one facts line and, when locked, a "Needs …" tag. Locked items
 * stay readable and openable (the detail explains what is missing), only dimmed.
 */
export function CatalogCard({
  who,
  title,
  meta,
  lockedLabel,
  selected,
  onClick,
  className,
}: CatalogCardProps) {
  const locked = lockedLabel != null && lockedLabel !== false;
  const cls = ['uicc', locked ? 'uicc--locked' : '', className].filter(Boolean).join(' ');
  return (
    <Card
      as="button"
      pad="none"
      emphasis="card"
      selected={selected}
      className={cls}
      onClick={onClick}
      aria-label={`${who}. ${title}`}
    >
      <span className="uicc-body">
        <span className="uicc-who">{who}</span>
        <span className="uicc-name">{title}</span>
        <span className="uicc-meta">{meta}</span>
        {locked && (
          <span className="uicc-tags">
            <Tag tone="rest" icon={<Icon name="info" />}>
              {lockedLabel}
            </Tag>
          </span>
        )}
      </span>
      <Icon name="caret-right" className="uicc-go" />
    </Card>
  );
}
