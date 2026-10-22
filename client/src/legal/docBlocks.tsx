import { Fragment, type ReactNode } from 'react';
import { DocTable } from '../components/ui/LegalDoc';
import type { DocBlock } from '../i18n/legal.types';

/** `**bold**` inside a text string → <strong>. Nothing else is interpreted (no HTML, no links). */
export function renderInline(text: string): ReactNode[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
    );
}

/** A section body from the texts' blocks: paragraphs, bullet lists, tables. */
export function renderBlocks(blocks: readonly DocBlock[]): ReactNode {
  return blocks.map((b, i) => {
    if ('p' in b) return <p key={i}>{renderInline(b.p)}</p>;
    if ('ul' in b)
      return (
        <ul key={i}>
          {b.ul.map((li, j) => (
            <li key={j}>{renderInline(li)}</li>
          ))}
        </ul>
      );
    return (
      <DocTable
        key={i}
        head={b.table.head}
        rows={b.table.rows.map((row) => row.map((cell) => renderInline(cell)))}
      />
    );
  });
}
