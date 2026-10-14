import type { ReactNode } from 'react';
import { Card } from './Card';
import './DataTable.css';

export interface DataTableColumn<R> {
  id: string;
  header: ReactNode;
  /** Numbers and amounts: right-aligned. */
  align?: 'start' | 'end';
  /** Bold cell (the row's name or its value). */
  strong?: boolean;
  /** Muted cell (a target, a secondary detail). */
  muted?: boolean;
  cell: (row: R) => ReactNode;
}

export interface DataTableProps<R> {
  /** Spoken name of the table. */
  label: string;
  columns: readonly DataTableColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** A quiet line under the rows ("All lifts"). */
  footer?: ReactNode;
  /** No card chrome (the table already sits inside a panel / Card). */
  bare?: boolean;
  /** Column headers stay in the DOM for assistive tech but are not drawn (a plain list of facts). */
  headless?: boolean;
  className?: string;
}

/**
 * Compact read-only table in a flush card (Client 360 lifts and sessions). 40px header, 48px rows, hairlines,
 * numbers right-aligned. Real <table> markup, so headers are announced.
 */
export function DataTable<R>({
  label,
  columns,
  rows,
  rowKey,
  footer,
  bare = false,
  headless = false,
  className,
}: DataTableProps<R>) {
  const cls = ['uidt', bare ? 'uidt--bare' : '', className].filter(Boolean).join(' ');
  const body = (
    <>
      <div
        className="uidt-scroll"
        {...(label ? { role: 'region', 'aria-label': label, tabIndex: 0 } : {})}
      >
        <table className="uidt-table" aria-label={label}>
          <thead className={headless ? 'visually-hidden' : undefined}>
            <tr>
              {columns.map((c) => (
                <th key={c.id} scope="col" className={c.align === 'end' ? 'is-end' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={
                      [
                        c.align === 'end' ? 'is-end' : '',
                        c.strong ? 'is-strong' : '',
                        c.muted ? 'is-muted' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer != null && <div className="uidt-foot">{footer}</div>}
    </>
  );
  return bare ? (
    <div className={cls}>{body}</div>
  ) : (
    <Card pad="none" className={cls}>
      {body}
    </Card>
  );
}
