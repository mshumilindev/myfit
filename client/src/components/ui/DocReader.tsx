import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../ui';
import './DocReader.css';

export interface ReaderDoc {
  id: string;
  label: string;
  /** The document itself, shown in a scroll box. */
  body: ReactNode;
}

export interface DocReaderProps {
  docs: readonly ReaderDoc[];
  /** id -> true once the person scrolled the document to its end. */
  read: Readonly<Record<string, boolean>>;
  onRead: (id: string) => void;
  /** "Read" */
  readLabel: string;
  /** "Scroll to the end" */
  unreadLabel: string;
}

/** How close to the bottom counts as the end (px): a rounding error or a sub-pixel gap must not block a person. */
export const END_SLACK = 12;

/** True when a scroll box shows its last line (or its content fits without scrolling). Pure: unit-tested. */
export function atEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  return scrollTop + clientHeight >= scrollHeight - END_SLACK;
}

function Doc({
  doc,
  isRead,
  open,
  onToggle,
  onRead,
  readLabel,
  unreadLabel,
}: {
  doc: ReaderDoc;
  isRead: boolean;
  open: boolean;
  onToggle: () => void;
  onRead: () => void;
  readLabel: string;
  unreadLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(isRead ? 100 : 0);
  const check = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setPct(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
    if (atEnd(el.scrollTop, el.clientHeight, el.scrollHeight)) onRead();
  }, [onRead]);
  // A short document that fits without scrolling counts as read the moment it is shown.
  useEffect(() => {
    if (open && !isRead) check();
  }, [open, isRead, check]);
  return (
    <div className={`uidrd-doc${isRead ? ' is-read' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="uidrd-head" aria-expanded={open} onClick={onToggle}>
        <span className="uidrd-ico" aria-hidden="true">
          <Icon name={isRead ? 'check-circle' : 'note'} weight={isRead ? 'fill' : 'bold'} />
        </span>
        <span className="uidrd-txt">
          <span className="ut-base ut-w6">{doc.label}</span>
          <span className="ut-xs">{isRead ? readLabel : unreadLabel}</span>
        </span>
        <span className="uidrd-caret" aria-hidden="true">
          <Icon name="caret-down" />
        </span>
      </button>
      {open && (
        <>
          <div
            className="uidrd-box"
            ref={box}
            tabIndex={0}
            role="region"
            aria-label={doc.label}
            onScroll={check}
          >
            {doc.body}
          </div>
          <div className="uidrd-prog" aria-hidden="true">
            <i style={{ width: `${isRead ? 100 : pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Documents read on the page: each opens in its own scroll box and counts as read only when scrolled to the end
 * (green check, "Read"). Presentational: the caller keeps `read` (the kit's `useDocReadGate`). Story `Kit/DocReader`.
 */
export function DocReader({ docs, read, onRead, readLabel, unreadLabel }: DocReaderProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="uidrd">
      {docs.map((d) => (
        <Doc
          key={d.id}
          doc={d}
          isRead={read[d.id] === true}
          open={openId === d.id}
          onToggle={() => setOpenId(openId === d.id ? null : d.id)}
          onRead={() => onRead(d.id)}
          readLabel={readLabel}
          unreadLabel={unreadLabel}
        />
      ))}
    </div>
  );
}
