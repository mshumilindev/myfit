import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { Avatar } from './Avatar';
import { IconButton } from './Button';
import { Card } from './Card';
import { ListRow } from './GroupedList';
import { IconTile } from './IconTile';
import { Tag } from './Tag';
import { SeverityDot } from './SeverityDot';
import type { Tone } from './tones';
import './StageBoard.css';

export interface BoardCardData {
  id: string;
  /** Client first name on the card, full name in the aria label. */
  name: string;
  fullName: string;
  /** Who the card is about, for the face (`renderAvatar`). */
  clientId?: string;
  hasPhoto?: boolean;
  /** Status word ("Urgent", "Measuring", "Improved") and its colour family. */
  status: string;
  tone: Tone;
  title: string;
  line?: string;
}

export interface BoardStage {
  id: string;
  label: string;
  icon: string;
  cards: BoardCardData[];
}

const FOLDED_W = 'calc(var(--s-48) + var(--s-24))';
const NARROW_W = 'calc((100% - 2 * var(--s-16)) / 3)';

export interface StageBoardProps {
  stages: BoardStage[];
  /** Id of the card whose detail is open (drawer / sheet). */
  selectedId?: string | null;
  onOpen: (cardId: string) => void;
  /** aria-label of the scroll region ("Stage board, scroll for more"). */
  label: string;
  emptyText: string;
  /** Phone: stages as an accordion (one open) instead of columns. */
  accordion?: boolean;
  /** Which stage starts open in the accordion (default none: the collapsed lab state). */
  defaultOpen?: string | null;
  footer?: ReactNode;
  /**
   * Columns can be folded to their header (icon + count) to give the others room (C-14 "Collapsed"). Wide layout only:
   * the accordion is already one-open-at-a-time. The label builds the accessible name of the fold button.
   */
  foldLabel?: (stageLabel: string, folded: boolean) => string;
  /** Stage ids folded at the start (stories, tests). */
  defaultFolded?: readonly string[];
  /** The face on a card (default: the kit initials disc; Coach passes the app Avatar). */
  renderAvatar?: (card: BoardCardData, size: number) => ReactNode;
  className?: string;
}

/**
 * The "By stage" board (C-14). Five columns (Signal, Evidence, Decided, Measuring, Result) with cards;
 * below 1280 three columns show and the rest scroll with snap and an edge fade; on a phone
 * (`accordion`) each stage is a collapsible header. Cards are buttons: the keyboard order is column by
 * column, and opening a card is the only way to act (no drag).
 */
export function StageBoard({
  stages,
  selectedId,
  onOpen,
  label,
  emptyText,
  accordion = false,
  defaultOpen = null,
  footer,
  foldLabel,
  defaultFolded = [],
  renderAvatar,
  className,
}: StageBoardProps) {
  const uid = useId();
  const [open, setOpen] = useState<string | null>(defaultOpen);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(defaultFolded));
  const toggleFold = (id: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const cardsOf = (s: BoardStage) =>
    s.cards.length ? (
      <ul className="uistage-cards">
        {s.cards.map((c) => (
          <li key={c.id}>
            <Card
              as="button"
              pad="md"
              className={['uistage-card', selectedId === c.id ? 'is-on' : '']
                .filter(Boolean)
                .join(' ')}
              aria-current={selectedId === c.id ? 'true' : undefined}
              aria-label={`${c.fullName}, ${c.status}: ${c.title}`}
              onClick={() => onOpen(c.id)}
            >
              <span className="uistage-card-top">
                {renderAvatar ? renderAvatar(c, 28) : <Avatar name={c.fullName} size={28} />}
                <span className="uistage-card-name">{c.name}</span>
                <SeverityDot tone={c.tone}>{c.status}</SeverityDot>
              </span>
              <span className="uistage-card-title">{c.title}</span>
              {c.line && <span className="uistage-card-line">{c.line}</span>}
            </Card>
          </li>
        ))}
      </ul>
    ) : (
      <p className="uistage-empty">{emptyText}</p>
    );

  if (accordion) {
    return (
      <div className={['uistage uistage--acc', className].filter(Boolean).join(' ')}>
        {stages.map((s) => {
          const isOpen = open === s.id;
          return (
            <Card key={s.id} as="section" pad="none" className="uistage-acc">
              <h2 className="uistage-acc-h">
                <ListRow
                  className="uistage-acc-b"
                  icon={<IconTile icon={s.icon} size={30} />}
                  strong
                  label={s.label}
                  trailing={
                    <>
                      <Tag tone="neutral">{s.cards.length}</Tag>
                      <Icon name={isOpen ? 'caret-up' : 'caret-down'} className="uirow-chev" />
                    </>
                  }
                  aria-expanded={isOpen}
                  aria-controls={`${uid}-${s.id}`}
                  onClick={() => setOpen(isOpen ? null : s.id)}
                />
              </h2>
              {isOpen && (
                <div id={`${uid}-${s.id}`} className="uistage-acc-body">
                  {cardsOf(s)}
                </div>
              )}
            </Card>
          );
        })}
        {footer && <div className="uistage-foot">{footer}</div>}
      </div>
    );
  }

  return (
    <div className={['uistage', className].filter(Boolean).join(' ')}>
      <div className="uistage-scroll" role="region" aria-label={label} tabIndex={0}>
        <div
          className={['uistage-cols', folded.size ? 'has-folded' : ''].filter(Boolean).join(' ')}
          style={
            folded.size
              ? ({
                  '--uistage-tpl': stages
                    .map((s) => (folded.has(s.id) ? FOLDED_W : 'minmax(0, 1fr)'))
                    .join(' '),
                  '--uistage-tpl-narrow': stages
                    .map((s) => (folded.has(s.id) ? FOLDED_W : NARROW_W))
                    .join(' '),
                } as CSSProperties)
              : undefined
          }
        >
          {stages.map((s) => {
            const isFolded = folded.has(s.id);
            return (
              <section
                key={s.id}
                className={['uistage-col', isFolded ? 'is-folded' : ''].filter(Boolean).join(' ')}
                aria-labelledby={`${uid}-h-${s.id}`}
              >
                <h2 className="uistage-col-h" id={`${uid}-h-${s.id}`}>
                  {!isFolded && <Icon name={s.icon} />}
                  {!isFolded && <span className="uistage-col-l">{s.label}</span>}
                  {isFolded && <span className="uistage-sr">{s.label}</span>}
                  <Tag tone="neutral">{s.cards.length}</Tag>
                  {foldLabel && (
                    <IconButton
                      icon={isFolded ? 'caret-right' : 'caret-down'}
                      size="sm"
                      label={foldLabel(s.label, isFolded)}
                      aria-expanded={!isFolded}
                      onClick={() => toggleFold(s.id)}
                    />
                  )}
                </h2>
                {!isFolded && cardsOf(s)}
              </section>
            );
          })}
        </div>
      </div>
      {footer && <div className="uistage-foot">{footer}</div>}
    </div>
  );
}
