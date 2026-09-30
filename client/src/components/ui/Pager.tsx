import { useT } from '../../i18n';
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

/** Quiet pager for any paged list: ‹ 2 / 6 ›. (Week-based lists use WeekStepper.) */
export function Pager({ page, maxPage, onPage, className }: PagerProps) {
  const { t } = useT();
  if (maxPage <= 0) return null;
  return (
    <nav className={['uipager', className].filter(Boolean).join(' ')} aria-label={t.pagination}>
      <IconButton
        variant="secondary"
        shape="round"
        size="sm"
        icon="caret-left"
        label={t.pagePrev}
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      />
      <span className="uipager-of" aria-live="polite" aria-current="page">
        <b>{page + 1}</b> / {maxPage + 1}
      </span>
      <IconButton
        variant="secondary"
        shape="round"
        size="sm"
        icon="caret-right"
        label={t.pageNext}
        disabled={page >= maxPage}
        onClick={() => onPage(page + 1)}
      />
    </nav>
  );
}
