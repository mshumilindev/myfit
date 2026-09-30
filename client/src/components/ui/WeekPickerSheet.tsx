import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GroupedList, ListRow } from './GroupedList';
import { Pager } from './Pager';
import { Sheet } from './Overlays';
import { WeekBars, type WeekBar } from './WeekBars';
import './WeekPickerSheet.css';

export interface WeekOption {
  label: string;
  sub: ReactNode;
  bars: WeekBar[];
}

/**
 * Pick any week: a drawer that is always the full screen height, the weeks
 * paged (kit Pager) so it never grows or shrinks; each row shows its range,
 * a caption and how the week was filled (WeekBars).
 */
export function WeekPickerSheet(p: {
  title: string;
  hint?: string;
  /** Newest first; index = weeks ago. */
  weeks: WeekOption[];
  selected: number;
  onPick: (index: number) => void;
  onClose: () => void;
  pageSize?: number;
}) {
  // As many weeks per page as fit the drawer's max height (no inner scrolling):
  // measured from the real row height and everything else in the drawer.
  const [fit, setFit] = useState(p.pageSize ?? 8);
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (p.pageSize) return;
    const measure = () => {
      const list = listRef.current;
      const sheet = list?.parentElement;
      if (!list || !sheet) return;
      const rows = list.querySelectorAll('.uigl-rows > *').length || 1;
      const rowH = list.scrollHeight / rows;
      const cs = getComputedStyle(sheet);
      const maxH = cs.maxHeight === 'none' ? sheet.clientHeight : parseFloat(cs.maxHeight);
      const kids = Array.from(sheet.children).filter((c) => c !== list) as HTMLElement[];
      const used =
        kids.reduce((n, c) => n + c.offsetHeight, 0) +
        (parseFloat(cs.rowGap) || 0) * kids.length +
        parseFloat(cs.paddingTop) +
        parseFloat(cs.paddingBottom);
      const n = Math.floor((maxH - used) / rowH);
      if (Number.isFinite(n)) setFit(Math.max(3, n));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [p.pageSize, p.weeks.length]);
  const size = fit;
  const lastPage = Math.max(0, Math.ceil(p.weeks.length / size) - 1);
  const [page, setPage] = useState(Math.floor(p.selected / size));
  const shownPage = Math.min(page, lastPage);
  const from = shownPage * size;
  return (
    <Sheet onClose={p.onClose} className="uiwps">
      <div className="uiwps-head">
        <div className="uiwps-title">{p.title}</div>
        {p.hint && <div className="uiwps-hint">{p.hint}</div>}
      </div>
      <div className="uiwps-list" ref={listRef}>
        <GroupedList>
          {p.weeks.slice(from, from + size).map((w, k) => {
            const i = from + k;
            return (
              <ListRow
                key={i}
                label={w.label}
                sub={w.sub}
                selected={i === p.selected}
                trailing={<WeekBars days={w.bars} />}
                onClick={() => p.onPick(i)}
              />
            );
          })}
        </GroupedList>
      </div>
      <Pager page={shownPage} maxPage={lastPage} onPage={setPage} />
    </Sheet>
  );
}
