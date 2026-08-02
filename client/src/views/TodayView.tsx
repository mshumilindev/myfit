/** Today — design S-10…S-16. */
import { useEffect, useState } from 'react';
import type { Shell } from '../App';
import type { Gym } from '../types';
import {
  backfillWorkout,
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
  fmtShortDate,
  useT,
} from '../i18n';
import { WeekStrip } from '../components/WeekStrip';
import { Icon, LanguageSelector, Sheet, Spinner, EmptyState } from '../ui';
import { DateField, TimeField, DurationField } from '../components/PickerFields';
import { GymPicker } from '../components/GymPicker';
import { GymThumb } from '../components/GymThumb';

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
  const [startPicker, setStartPicker] = useState(false);

  function beginSession(gymId: string | null) {
    setStartPicker(false);
    const w = startWorkout(gymId);
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }
  const [backfill, setBackfill] = useState(false);
  const open = store.workouts.find((w) => w.finishedAt === null);
  const now = useNowTick(!!open);

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const firstLoad = store.workouts.length === 0 && store.lastSyncAt === null && !!store.queue;
  const showSkeleton = firstLoad && store.syncStatus === 'syncing';

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayFinished = finished.some((w) => w.startedAt >= dayStart.getTime());

  const headline = open ? t.midSession : todayFinished ? t.sessionDone : t.nothingLoggedYet;

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

      {finished.length > 0 && <WeekStrip />}

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

      {!open && (
        <button
          className="btn btn-primary btn-big"
          onClick={() => {
            if (store.gyms.length > 0) setStartPicker(true);
            else beginSession(null);
          }}
        >
          <Icon name="play" />
          {finished.length === 0 ? t.startFirstSession : t.startEmptySession}
        </button>
      )}

      {!open && (
        <button className="backfill-trigger" onClick={() => setBackfill(true)}>
          <Icon name="arrow-counter-clockwise" />
          <span>{t.logPastSession}</span>
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

      {finished.length === 0 ? (
        <>
          <EmptyState icon="barbell" title={t.noHistoryYet} body={t.noHistoryBody} />
          {!open && store.gyms.length === 0 && (
            <button className="gym-hint" onClick={() => shell.goTab('gyms')}>
              <Icon name="map-pin" />
              <span style={{ flex: 1, textAlign: 'left' }}>{t.addGymHint}</span>
              <span style={{ color: 'var(--color-accent)', fontSize: 12 }}>{t.add}</span>
            </button>
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
      {startPicker && (
        <GymPicker
          gyms={store.gyms}
          title={t.pickGymTitle}
          onClose={() => setStartPicker(false)}
          onPick={beginSession}
        />
      )}
      {backfill && (
        <BackfillSheet
          gyms={store.gyms}
          onClose={() => setBackfill(false)}
          onCreate={(startedAt, durationMs, gymId) => {
            const w = backfillWorkout(startedAt, durationMs, gymId);
            setBackfill(false);
            shell.openOverlay({ screen: 'past-workout', workoutId: w.id, startAdd: true });
          }}
        />
      )}
    </div>
  );
}

/** Backfill a past session — spec docs/specs/backfill-session.md (AC-1…AC-3). */
function BackfillSheet(props: {
  gyms: Gym[];
  onClose: () => void;
  onCreate: (startedAt: number, durationMs: number, gymId: string | null) => void;
}) {
  const { t } = useT();
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymPicker, setGymPicker] = useState(false);
  const chosenGym = props.gyms.find((g) => g.id === gymId) ?? null;
  const [defaults] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
  });
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [now] = useState(() => Date.now());

  const [todayIso] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

  const startedAt = new Date(`${date}T${time}`).getTime();
  const inFuture = !Number.isNaN(startedAt) && startedAt > now;
  const badDuration = duration < 1 || duration > 480;
  const invalid = Number.isNaN(startedAt) || inFuture || badDuration;

  return (
    <Sheet onClose={props.onClose} className="backfill-sheet">
      <div className="sheet-head backfill-head">
        <Icon name="arrow-counter-clockwise" />
        <span className="t">{t.logPastSession}</span>
      </div>
      <div className="backfill-fields">
        <label className="field-block">
          <span className="field-label">{t.backfillDate}</span>
          <DateField value={date} onChange={setDate} max={todayIso} />
        </label>
        <div className="backfill-grid">
          <label className="field-block">
            <span className="field-label">{t.backfillStart}</span>
            <TimeField value={time} onChange={setTime} />
          </label>
          <label className="field-block">
            <span className="field-label">{t.backfillDuration}</span>
            <DurationField value={duration} onChange={setDuration} />
          </label>
        </div>
      </div>
      {props.gyms.length > 0 && (
        <label className="field-block">
          <span className="field-label">{t.backfillGym}</span>
          <button
            type="button"
            className="input gym-select"
            onClick={() => setGymPicker((x) => !x)}
          >
            {chosenGym ? (
              <span className="gym-select-chosen">
                <span className="thumb">
                  <GymThumb
                    name={chosenGym.name}
                    lat={chosenGym.lat}
                    lng={chosenGym.lng}
                    size={28}
                  />
                </span>
                {chosenGym.name}
              </span>
            ) : (
              <span className="gym-select-placeholder">{t.backfillGymChoose}</span>
            )}
            <Icon name={gymPicker ? 'caret-left' : 'arrow-right'} className="go" />
          </button>
          {gymPicker && (
            <GymPicker
              gyms={props.gyms}
              title={t.pickGymTitle}
              variant="inline"
              onClose={() => setGymPicker(false)}
              onPick={(id) => {
                setGymId(id);
                setGymPicker(false);
              }}
            />
          )}
        </label>
      )}
      {inFuture && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {t.backfillFuture}
        </div>
      )}
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          disabled={invalid}
          onClick={() => props.onCreate(startedAt, duration * 60000, gymId)}
        >
          {t.backfillContinue}
        </button>
      </div>
    </Sheet>
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
