/**
 * Full history — finished workouts and activities merged into one day-grouped
 * timeline, newest day first, one week (7 days) per page with numbered
 * pagination. Reached from the "See all history" link under the Today preview.
 */
import { Pager } from '../components/ui/Pager';
import { BackButton } from '../components/ui/BackButton';
import { useState } from 'react';
import type { Shell } from '../App';
import { latestWeight, useStore } from '../store';
import { useT } from '../i18n';
import { HistoryTimeline, buildHistoryDays } from '../components/HistoryTimeline';

const PAGE_DAYS = 7; // one week per page

export function HistoryListView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const [page, setPage] = useState(0);

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const workoutCount = finished.length;
  const totalDays = buildHistoryDays(finished, store.activities, store.sleeps).length;
  const maxPage = Math.max(0, Math.ceil(totalDays / PAGE_DAYS) - 1);
  const curPage = Math.min(page, maxPage);

  return (
    <div className="screen hist-list">
      <div className="hist-head">
        <BackButton onClick={onClose} label={t.backAction} />
        <div className="uf-1 umw-0">
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
            sleeps={store.sleeps}
            allWorkouts={store.workouts}
            bodyKg={bodyKg}
            maxDays={PAGE_DAYS}
            dayOffset={curPage * PAGE_DAYS}
            onOpenWorkout={(id) => shell.openOverlay({ screen: 'past-workout', workoutId: id })}
            onOpenActivity={(id) => shell.openOverlay({ screen: 'activity', editId: id })}
            onOpenSleep={(id) => shell.openOverlay({ screen: 'sleep', mode: 'edit', nightId: id })}
          />
          {maxPage > 0 && <Pager page={curPage} maxPage={maxPage} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
