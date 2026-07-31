/** Today — design S-10…S-16. */
import { useEffect, useState } from 'react';
import type { Shell } from '../App';
import {
  dismissReminder,
  logVisitAsWorkout,
  repeatWorkout,
  startWorkout,
  workoutSets,
  workoutVolumeKg,
  type useStore,
} from '../store';
import {
  fmtDayMonth,
  fmtDurationHM,
  fmtDurationHuman,
  fmtFullDate,
  fmtKg,
  fmtSessionClock,
  fmtShortDate,
  fmtTonnes,
  useT,
} from '../i18n';
import { Icon, LanguageSelector, Spinner, EmptyState } from '../ui';

type Store = ReturnType<typeof useStore>;

function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [active]);
  return now;
}

export function TodayView({ shell, store }: { shell: Shell; store: Store }) {
  const { t, locale } = useT();
  const open = store.workouts.find((w) => w.finishedAt === null);
  const now = useNowTick(!!open);

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const firstLoad = store.workouts.length === 0 && store.lastSyncAt === null && !!store.queue;
  const showSkeleton = firstLoad && store.syncStatus === 'syncing';

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayFinished = finished.some((w) => w.startedAt >= dayStart.getTime());

  const headline = open ? t.midSession : todayFinished ? t.sessionDone : t.nothingLoggedYet;

  // Monday-first current week.
  const week: { letter: string; ts: number; logged: boolean; isToday: boolean }[] = [];
  const monday = new Date(dayStart);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayEnd = d.getTime() + 24 * 3600 * 1000;
    week.push({
      letter: t.weekDayLetters[i],
      ts: d.getTime(),
      logged: finished.some((w) => w.startedAt >= d.getTime() && w.startedAt < dayEnd),
      isToday: d.getTime() === dayStart.getTime(),
    });
  }

  const reminder = store.reminders[0];
  const queuedIds = new Set(
    store.queue.map((q) => q.url.match(/workouts\/([0-9a-f-]+)/)?.[1]).filter(Boolean),
  );
  const lastFinished = finished[0];

  if (showSkeleton) {
    return (
      <div className="screen" style={{ gap: 'var(--space-6)' }}>
        <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="sk" style={{ width: 120, height: 10 }} />
          <div className="sk" style={{ width: 210, height: 26 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="sk" style={{ flex: 1, height: 46 }} />
          ))}
        </div>
        <div className="sk" style={{ height: 62, borderRadius: 14 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="sk" style={{ flex: 1, height: 92 }} />
          <div className="sk" style={{ flex: 1, height: 92 }} />
        </div>
        <div className="sk" style={{ width: 70, height: 9 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div className="sk" style={{ width: 40, height: 9 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="sk" style={{ width: '45%', height: 13 }} />
              <div className="sk" style={{ width: '65%', height: 9 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="today-head">
        <div>
          <div className="kicker">{fmtFullDate(now, locale)}</div>
          <h1 className="headline" style={{ fontSize: 26 }}>
            {headline}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SyncChip store={store} />
          <LanguageSelector />
        </div>
      </div>

      {store.syncStatus === 'offline' && store.queue.length > 0 && (
        <div className="banner offline">
          <Icon name="cloud-slash" />
          <span>{t.offlineQueued(store.queue.length)}</span>
        </div>
      )}

      {store.syncStatus === 'syncing' && store.queue.length > 0 && (
        <div className="sync-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="arrows-clockwise" className="num" />
            <span style={{ fontSize: 12, color: 'var(--color-neutral-300)', flex: 1 }}>
              {t.sendingQueued}
            </span>
            <span className="num" style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
              {store.queue.length}
            </span>
          </div>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: '66%' }} />
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div className="weekstrip">
          {week.map((d, i) => (
            <div key={i} className={`cell${d.isToday ? ' today-ring' : ''}`}>
              <div className="day">{d.letter}</div>
              <div className={`dot${d.logged ? ' on' : ''}`} />
            </div>
          ))}
        </div>
      )}

      {reminder && !open && (
        <div className="reminder-card">
          <Icon name="map-pin" />
          <div>
            {t.unloggedVisit(
              fmtDurationHuman(reminder.visitEnd - reminder.visitStart),
              reminder.gymName,
              fmtDayMonth(reminder.visitStart, locale),
            )}
            <div className="reminder-actions">
              <button
                className="link"
                onClick={() => {
                  const w = logVisitAsWorkout(reminder);
                  shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
                }}
              >
                {t.logIt}
              </button>
              <button className="link-muted" onClick={() => dismissReminder(reminder)}>
                {t.dismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      {open ? (
        <button
          className="live-card"
          onClick={() => shell.openOverlay({ screen: 'session', workoutId: open.id })}
        >
          <span className="pulse" />
          <span style={{ flex: 1 }}>
            <span className="t">{t.sessionInProgress}</span>
            <div className="m">
              {fmtSessionClock(now - open.startedAt)} · {workoutSets(open)} {t.sets} ·{' '}
              {fmtTonnes(workoutVolumeKg(open))}
            </div>
          </span>
          <Icon name="arrow-right" />
        </button>
      ) : (
        <button
          className="btn btn-primary btn-big"
          onClick={() => {
            const w = startWorkout();
            shell.openOverlay({ screen: 'session', workoutId: w.id });
          }}
        >
          <Icon name="play" />
          {finished.length === 0 ? t.startFirstSession : t.startEmptySession}
        </button>
      )}

      {store.syncStatus === 'offline' && (
        <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', padding: '0 2px' }}>
          {t.servedFromCache}
        </div>
      )}

      {!open && lastFinished && (
        <div className="quick">
          <button
            className="tile"
            onClick={() => {
              const w = repeatWorkout(lastFinished.id);
              if (w) shell.openOverlay({ screen: 'session', workoutId: w.id });
            }}
          >
            <Icon name="arrow-counter-clockwise" />
            <div className="t">{t.repeat(fmtDayMonth(lastFinished.startedAt, locale))}</div>
            <div className="s">
              {lastFinished.exercises.length} {t.exercises}
            </div>
          </button>
        </div>
      )}

      {finished.length === 0 && !open ? (
        <>
          <EmptyState icon="barbell" title={t.noHistoryYet} body={t.noHistoryBody} />
          {store.gyms.length === 0 && (
            <div className="gym-hint">
              <Icon name="map-pin" />
              <span style={{ flex: 1 }}>{t.addGymHint}</span>
              <span style={{ color: 'var(--color-accent)', fontSize: 12 }}>{t.add}</span>
            </div>
          )}
        </>
      ) : (
        finished.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 'var(--space-2)' }}>
              {t.recent}
            </div>
            <div>
              {finished.slice(0, 5).map((w) => (
                <button
                  key={w.id}
                  className="recent-row"
                  onClick={() => shell.openOverlay({ screen: 'past-workout', workoutId: w.id })}
                >
                  <span className="d">{fmtShortDate(w.startedAt, locale)}</span>
                  <span style={{ flex: 1 }}>
                    <span className="name">{fmtDayMonth(w.startedAt, locale)}</span>
                    {w.autoFinished && (
                      <span className="tag tag-neutral" style={{ marginLeft: 6 }}>
                        {t.autoClosed}
                      </span>
                    )}
                    {queuedIds.has(w.id) && (
                      <span className="tag tag-neutral" style={{ marginLeft: 6 }}>
                        {t.queued}
                      </span>
                    )}
                    <div className="stats">
                      {workoutSets(w)} {t.sets} · {fmtKg(workoutVolumeKg(w))}
                      {w.finishedAt ? ` · ${fmtDurationHM(w.finishedAt - w.startedAt)}` : ''}
                    </div>
                  </span>
                  <Icon name="arrow-up-right" className="go" />
                </button>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

export function SyncChip({ store }: { store: Store }) {
  const { t } = useT();
  const s = store.syncStatus;
  if (s === 'syncing') {
    return (
      <div className="sync-chip">
        <Spinner size={11} />
        <span>{t.syncing}</span>
      </div>
    );
  }
  if (s === 'offline') {
    return (
      <div className="sync-chip danger">
        <span className="dot" />
        <span>{t.offline}</span>
      </div>
    );
  }
  return (
    <div className={`sync-chip${s === 'synced' ? ' ok' : ''}`}>
      <span
        className="dot"
        style={s !== 'synced' ? { background: 'var(--color-neutral-600)' } : undefined}
      />
      <span>{s === 'synced' ? t.synced : t.syncing}</span>
    </div>
  );
}
