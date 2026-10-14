/**
 * InfoTable: a plain, read-only key-value list (a definition list). Muted label on the left, regular value on
 * the right, thin dividers between rows. No surface, no hover, no chevron: it is information, not navigation
 * (use GroupedList rows for anything that can be opened or changed).
 */
import type { ReactNode } from 'react';
import './InfoTable.css';

export interface InfoRow {
  id: string;
  label: ReactNode;
  value: ReactNode;
  /** Extra class on the row (a dimmed row, a state hook for tests). */
  className?: string;
}

export interface InfoTableProps {
  rows: readonly InfoRow[];
  /** Accessible name of the table. */
  label?: string;
  className?: string;
}

export function InfoTable({ rows, label, className }: InfoTableProps) {
  return (
    <dl className={['uiinfo', className].filter(Boolean).join(' ')} aria-label={label}>
      {rows.map((r) => (
        <div className={['uiinfo-row', r.className].filter(Boolean).join(' ')} key={r.id}>
          <dt className="uiinfo-k">{r.label}</dt>
          <dd className="uiinfo-v">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
