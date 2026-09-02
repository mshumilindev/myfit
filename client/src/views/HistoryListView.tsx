/**
 * Full history — finished workouts and activities merged into one day-grouped
 * timeline, newest day first, one week (7 days) per page with numbered
 * pagination. Reached from the "See all history" link under the Today preview.
 */
import { useState } from 'react';
import type { Shell } from '../App';
import { latestWeight, useStore } from '../store';
import { useT } from '../i18n';
import { HistoryTimeline, buildHistoryDays } from '../components/HistoryTimeline';
import { Icon } from '../ui';

const PAGE_DAYS = 7; // one week per page

const ELLIPSIS = -1;
/** Page numbers to show (0-based) with ELLIPSIS gaps — always first + last, the
 *  current page and its neighbours, capped so the control never grows past ~7
 *  slots. Mirrors the exercise list's pager. */
function pageWindow(cur: number, last: number): number[] {
  const total = last + 1;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: number[] = [0];
  const start = Math.max(1, cur - 1);
  const end = Math.min(last - 1, cur + 1);
  if (start > 1) out.push(ELLIPSIS);
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < last - 1) out.push(ELLIPSIS);
  out.push(last);
  return out;
}

export function HistoryListView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const [page, setPage] = useState(0);

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const workoutCount = finished.length;
  const totalDays = buildHistoryDays(finished, store.activities).length;
  const maxPage = Math.max(0, Math.ceil(totalDays / PAGE_DAYS) - 1);
  const curPage = Math.min(page, maxPage);

  return (
    <div className="screen hist-list" style={{ gap: 'var(--space-5)' }}>
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-26">{t.tdHistory}</h2>
          <div className="hist-list-sub">{t.historyCount(workoutCount)}</div>
        </div>
      </div>

      {totalDays === 0 ? (
        <div className="detail-muted">{t.noHistoryYet}</div>
      ) : (
        <>
          <HistoryTimeline
            workouts={finished}
            activities={store.activities}
            allWorkouts={store.workouts}
            bodyKg={bodyKg}
            maxDays={PAGE_DAYS}
            dayOffset={curPage * PAGE_DAYS}
            onOpenWorkout={(id) => shell.openOverlay({ screen: 'past-workout', workoutId: id })}
            onOpenActivity={(id) => shell.openOverlay({ screen: 'activity', editId: id })}
          />
          {maxPage > 0 && (
            <nav className="exl-pager" aria-label={t.pagination}>
              <button
                className="exl-pagebtn"
                disabled={curPage === 0}
                onClick={() => setPage(curPage - 1)}
                aria-label={t.pagePrev}
              >
                <Icon name="caret-left" />
              </button>
              {pageWindow(curPage, maxPage).map((p, i) =>
                p === ELLIPSIS ? (
                  <span key={`gap-${i}`} className="exl-pagegap">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`exl-pagenum${p === curPage ? ' active' : ''}`}
                    aria-current={p === curPage ? 'page' : undefined}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </button>
                ),
              )}
              <button
                className="exl-pagebtn"
                disabled={curPage >= maxPage}
                onClick={() => setPage(curPage + 1)}
                aria-label={t.pageNext}
              >
                <Icon name="caret-left" className="flip" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
