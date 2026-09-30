import { useT } from '../../i18n';
import { Chip } from './Chip';
import { IconButton } from './Button';
import './Pager.css';

export interface PagerProps {
  /** Current page, 0-based. */
  page: number;
  /** Last page, 0-based (a pager with one page renders nothing). */
  maxPage: number;
  onPage: (page: number) => void;
  className?: string;
}

const GAP = -1;

/** Page numbers to show (0-based) with GAP markers — always first + last, a window around the current. */
export function pageWindow(cur: number, last: number): number[] {
  if (last <= 6) return Array.from({ length: last + 1 }, (_, i) => i);
  const start = Math.max(1, cur - 1);
  const end = Math.min(last - 1, cur + 1);
  const out: number[] = [0];
  if (start > 1) out.push(GAP);
  for (let p = start; p <= end; p++) out.push(p);
  if (end < last - 1) out.push(GAP);
  out.push(last);
  return out;
}

/** Prev / numbered pages / next. Numbers are kit Chips, arrows kit IconButtons. */
export function Pager({ page, maxPage, onPage, className }: PagerProps) {
  const { t } = useT();
  if (maxPage <= 0) return null;
  return (
    <nav className={['uipager', className].filter(Boolean).join(' ')} aria-label={t.pagination}>
      <IconButton
        variant="secondary"
        size="sm"
        icon="caret-left"
        label={t.pagePrev}
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      />
      {pageWindow(page, maxPage).map((p, i) =>
        p === GAP ? (
          <span key={`gap-${i}`} className="uipager-gap">
            …
          </span>
        ) : (
          <Chip
            key={p}
            size="sm"
            tone="accent"
            selected={p === page}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPage(p)}
          >
            {p + 1}
          </Chip>
        ),
      )}
      <IconButton
        variant="secondary"
        size="sm"
        icon="caret-right"
        label={t.pageNext}
        disabled={page >= maxPage}
        onClick={() => onPage(page + 1)}
      />
    </nav>
  );
}
