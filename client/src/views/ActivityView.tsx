/**
 * Activity page (design feature 6, ACT-2/3): a first-class screen, not a sheet.
 * You land here after picking a type — nothing is logged until you press Start
 * (or Save a backfilled one). A started activity is a persisted, resumable
 * timer that survives closing the page; only Discard removes it. Finish and
 * Discard both confirm.
 */
import { useEffect, useState } from 'react';
import {
  useStore,
  latestWeight,
  liveActivity,
  startActivity,
  logActivity,
  pauseActivity,
  resumeActivity,
  updateActivity,
  finishActivity,
  discardActivity,
  editActivity,
  deleteActivity,
} from '../store';
import { useT } from '../i18n';
import { ConfirmDialog, Icon } from '../ui';
import { EffortGauge } from '../components/EffortGauge';
import { DateField } from '../components/PickerFields';
import { TimelineRange } from '../components/TimelineRange';
import { activityType, activityElapsedMs, isActivityPaused, estimateCalories } from '../activities';
import type { Activity, ActivityEffort } from '../types';

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function ActivityView({
  newType,
  editId,
  onClose,
}: {
  newType?: string;
  editId?: string;
  onClose: () => void;
}) {
  // Subscribe so pressing Start (which creates the live activity) flips this
  // view from the idle state into the running timer.
  const store = useStore();
  const live = liveActivity();
  // Editing an existing logged activity takes priority (opened from History).
  if (editId) {
    const existing = store.activities.find((a) => a.id === editId && a.finishedAt !== null);
    if (!existing) return <CloseOnMount onClose={onClose} />;
    return <EditActivity activity={existing} onClose={onClose} />;
  }
  // A live activity always wins; otherwise this is a fresh, not-yet-started one.
  if (live) return <RunningActivity onClose={onClose} />;
  const type = newType ? activityType(newType) : null;
  if (!type) return <CloseOnMount onClose={onClose} />;
  return <NewActivity typeKey={type.key} onClose={onClose} />;
}

const hhmmToMin = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minToHhmm = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function CloseOnMount({ onClose }: { onClose: () => void }) {
  useEffect(() => onClose(), [onClose]);
  return null;
}

/** Not-yet-started activity: Start the live timer, or log a past one here. */
function NewActivity({ typeKey, onClose }: { typeKey: string; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const type = activityType(typeKey)!;
  const isRecovery = type.category === 'recovery';
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  const [mode, setMode] = useState<'ready' | 'past'>('ready');
  const [effort, setEffort] = useState<ActivityEffort>('moderate');
  const [distance, setDistance] = useState('');
  const [todayIso] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState('00:00');
  const [duration, setDuration] = useState(720); // default range 00:00 → 12:00

  function start(): void {
    startActivity(type.key, type.category);
    // Live activity now exists → ActivityView re-renders into RunningActivity.
  }

  function savePast(): void {
    const startedAt = new Date(`${date}T${time}`).getTime();
    if (Number.isNaN(startedAt)) return;
    logActivity({
      type: type.key,
      category: type.category,
      startedAt,
      finishedAt: startedAt + duration * 60000,
      durationMin: duration,
      calories: estimateCalories(type, duration, bodyKg, effort),
      distanceKm: type.tracksDistance && distance ? Number(distance) || null : null,
      effort,
    });
    onClose();
  }

  const pastKcal = estimateCalories(type, duration, bodyKg, effort);

  return (
    <div className={`screen activity-screen cat-${type.category}`}>
      <ActivityHead type={type} isRecovery={isRecovery} onClose={onClose} t={t} />

      <div className="seg2 act-mode-seg">
        <button className={mode === 'ready' ? 'active' : ''} onClick={() => setMode('ready')}>
          {t.actStartNow}
        </button>
        <button className={mode === 'past' ? 'active' : ''} onClick={() => setMode('past')}>
          {t.actLogPast}
        </button>
      </div>

      {mode === 'ready' ? (
        <div className="av-ready">
          <p className="act-cap">{t.actReadyCap}</p>
          <button className="btn btn-primary av-start" onClick={start}>
            <Icon name="play" weight="fill" />
            {t.actStart}
          </button>
        </div>
      ) : (
        <div className="av-past">
          <label className="field-block">
            <span className="field-label">{t.backfillDate}</span>
            <DateField value={date} onChange={setDate} max={todayIso} />
          </label>
          <TimelineRange
            start={hhmmToMin(time)}
            duration={duration}
            onChange={(s, d) => {
              setTime(minToHhmm(s));
              setDuration(d);
            }}
            units={{ hrShort: t.hrShort, minShort: t.minShort }}
          />
          <EffortRow effort={effort} onEffort={setEffort} t={t} />
          {type.tracksDistance && <DistanceField value={distance} onChange={setDistance} t={t} />}
          <div className="act-summary-row">
            {pastKcal != null ? (
              <span className="act-kcal sm">
                <Icon name="flame" weight="fill" />
                <span className="tnum">~{pastKcal}</span>
                <em>{t.kcalShort}</em>
              </span>
            ) : (
              <span className="act-noweight-inline">{t.actNoWeight}</span>
            )}
            <button className="btn btn-primary" onClick={savePast}>
              <Icon name="check" weight="bold" />
              {t.actSave}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Edit a finished (logged) activity — same form as a backfill, prefilled, plus
 *  a Delete. Opened from the History timeline. */
function EditActivity({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const type = activityType(activity.type);
  const isRecovery = activity.category === 'recovery';
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  const start = new Date(activity.startedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const [date, setDate] = useState(
    `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`,
  );
  const [time, setTime] = useState(`${p(start.getHours())}:${p(start.getMinutes())}`);
  const [duration, setDuration] = useState(Math.max(1, Math.round(activity.durationMin)));
  const [effort, setEffort] = useState<ActivityEffort>(activity.effort ?? 'moderate');
  const [distance, setDistance] = useState(
    activity.distanceKm != null ? String(activity.distanceKm) : '',
  );
  const [confirmDel, setConfirmDel] = useState(false);
  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  if (!type) return <CloseOnMount onClose={onClose} />;
  const kcal = estimateCalories(type, duration, bodyKg, effort);

  function save(): void {
    const startedAt = new Date(`${date}T${time}`).getTime();
    if (Number.isNaN(startedAt)) return;
    editActivity(activity.id, {
      startedAt,
      finishedAt: startedAt + duration * 60000,
      durationMin: duration,
      calories: type ? estimateCalories(type, duration, bodyKg, effort) : null,
      distanceKm: type?.tracksDistance && distance ? Number(distance) || null : null,
      effort,
    });
    onClose();
  }

  return (
    <div className={`screen activity-screen cat-${activity.category}`}>
      <ActivityHead
        type={type}
        isRecovery={isRecovery}
        onClose={onClose}
        t={t}
        fallbackName={activity.type}
      />

      <div className="av-past">
        <label className="field-block">
          <span className="field-label">{t.backfillDate}</span>
          <DateField value={date} onChange={setDate} max={todayIso} />
        </label>
        <TimelineRange
          start={hhmmToMin(time)}
          duration={duration}
          onChange={(s, d) => {
            setTime(minToHhmm(s));
            setDuration(d);
          }}
          units={{ hrShort: t.hrShort, minShort: t.minShort }}
        />
        <EffortRow effort={effort} onEffort={setEffort} t={t} />
        {type.tracksDistance && <DistanceField value={distance} onChange={setDistance} t={t} />}
        <div className="act-summary-row">
          {kcal != null ? (
            <span className="act-kcal sm">
              <Icon name="flame" weight="fill" />
              <span className="tnum">~{kcal}</span>
              <em>{t.kcalShort}</em>
            </span>
          ) : (
            <span className="act-noweight-inline">{t.actNoWeight}</span>
          )}
          <button className="btn btn-primary" onClick={save}>
            <Icon name="check" weight="bold" />
            {t.actSave}
          </button>
        </div>
        <button className="btn danger-outline av-discard-btn" onClick={() => setConfirmDel(true)}>
          <Icon name="trash" />
          {t.delete}
        </button>
      </div>

      {confirmDel && (
        <ConfirmDialog
          title={t.actDeleteTitle}
          body={t.actDeleteBody}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteActivity(activity.id);
            setConfirmDel(false);
            onClose();
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

/** A running or paused live activity. */
function RunningActivity({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const activity = liveActivity();
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);

  const running = !!activity && !isActivityPaused(activity);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (!activity) onClose();
  }, [activity, onClose]);

  if (!activity) return null;

  const type = activityType(activity.type);
  const isRecovery = activity.category === 'recovery';
  const paused = isActivityPaused(activity);
  const elapsedMs = activityElapsedMs(activity, now);
  const minutes = elapsedMs / 60000;
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const effort = activity.effort ?? 'moderate';
  const kcal = type ? estimateCalories(type, minutes, bodyKg, effort) : null;

  return (
    <div className={`screen activity-screen cat-${activity.category}`}>
      <ActivityHead
        type={type}
        isRecovery={isRecovery}
        onClose={onClose}
        t={t}
        fallbackName={activity.type}
      />

      <div className="av-body">
        <div className={`av-clock tnum${paused ? ' paused' : ''}`}>{clock(elapsedMs)}</div>
        {paused && <div className="av-paused">{t.actPaused}</div>}

        {kcal != null ? (
          <div className="av-kcal">
            <Icon name="flame" weight="fill" />
            <span className="tnum">~{kcal}</span>
            <em>{t.kcalShort}</em>
          </div>
        ) : (
          <div className="av-noweight">
            <Icon name="scales" />
            {t.actNoWeight}
          </div>
        )}

        <EffortRow
          effort={effort}
          onEffort={(e) => updateActivity(activity.id, { effort: e })}
          t={t}
          className="av-effort"
        />

        {type?.tracksDistance && (
          <DistanceField
            className="av-distance"
            value={activity.distanceKm != null ? String(activity.distanceKm) : ''}
            onChange={(v) =>
              updateActivity(activity.id, { distanceKm: v === '' ? null : Number(v) || null })
            }
            t={t}
          />
        )}
      </div>

      <div className="av-actions">
        <button className="btn danger-outline av-discard-btn" onClick={() => setConfirm('discard')}>
          <Icon name="trash" />
          {t.actDiscard}
        </button>
        <button
          className="btn btn-secondary av-pause"
          onClick={() => (paused ? resumeActivity(activity.id) : pauseActivity(activity.id))}
        >
          <Icon name={paused ? 'play' : 'timer'} weight="fill" />
          {paused ? t.actResume : t.actPause}
        </button>
        <button
          className="btn btn-primary av-finish"
          disabled={minutes <= 0}
          onClick={() => setConfirm('finish')}
        >
          <Icon name="check" weight="bold" />
          {t.actFinish}
        </button>
      </div>

      {confirm === 'finish' && (
        <ConfirmDialog
          title={t.actFinishTitle}
          body={t.actFinishBody(Math.max(1, Math.round(minutes)))}
          confirmLabel={t.actFinish}
          cancelLabel={t.cancel}
          onConfirm={() => {
            finishActivity(activity.id, { calories: kcal });
            setConfirm(null);
            onClose();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'discard' && (
        <ConfirmDialog
          title={t.actDiscardTitle}
          body={t.actDiscardBody}
          confirmLabel={t.actDiscard}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            discardActivity(activity.id);
            setConfirm(null);
            onClose();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function ActivityHead({
  type,
  isRecovery,
  onClose,
  t,
  fallbackName,
}: {
  type: ReturnType<typeof activityType>;
  isRecovery: boolean;
  onClose: () => void;
  t: ReturnType<typeof useT>['t'];
  fallbackName?: string;
}) {
  return (
    <div className="av-head">
      <button className="back" onClick={onClose} aria-label={t.backAction}>
        <Icon name="caret-left" />
      </button>
      <span className="av-head-name">
        <Icon name={type?.icon ?? 'heartbeat'} />
        {type ? (t.actType[type.key] ?? type.key) : (fallbackName ?? '')}
      </span>
      <span className={`act-cat-badge cat-${isRecovery ? 'recovery' : 'conditioning'}`}>
        <Icon name={isRecovery ? 'wave-sine' : 'lightning'} weight="fill" />
        {isRecovery ? t.actCountsRecovery : t.actAddsConditioning}
      </span>
    </div>
  );
}

function EffortRow({
  effort,
  onEffort,
  t,
  className,
}: {
  effort: ActivityEffort;
  onEffort: (e: ActivityEffort) => void;
  t: ReturnType<typeof useT>['t'];
  className?: string;
}) {
  return (
    <div className={className ?? 'act-effort'}>
      <EffortGauge
        title={t.actEffort}
        value={effort}
        onChange={onEffort}
        options={EFFORTS.map((e) => ({ value: e, label: t.actEffortLevel[e] }))}
      />
    </div>
  );
}

function DistanceField({
  value,
  onChange,
  t,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  t: ReturnType<typeof useT>['t'];
  className?: string;
}) {
  return (
    <label className={`act-field ${className ?? 'act-distance'}`}>
      <span>{t.actDistance}</span>
      <div className="act-min">
        <input
          type="number"
          min={0}
          step="0.1"
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <em>{t.kmShort}</em>
      </div>
    </label>
  );
}
