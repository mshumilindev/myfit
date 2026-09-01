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
} from '../store';
import { useT } from '../i18n';
import { ConfirmDialog, Icon } from '../ui';
import { DateField, TimeField, DurationField } from '../components/PickerFields';
import { activityType, activityElapsedMs, isActivityPaused, estimateCalories } from '../activities';
import type { ActivityEffort } from '../types';

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

export function ActivityView({ newType, onClose }: { newType?: string; onClose: () => void }) {
  // Subscribe so pressing Start (which creates the live activity) flips this
  // view from the idle state into the running timer.
  useStore();
  const live = liveActivity();
  // A live activity always wins; otherwise this is a fresh, not-yet-started one.
  if (live) return <RunningActivity onClose={onClose} />;
  const type = newType ? activityType(newType) : null;
  if (!type) return <CloseOnMount onClose={onClose} />;
  return <NewActivity typeKey={type.key} onClose={onClose} />;
}

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
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(30);

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
      <span className="act-field-label">{t.actEffort}</span>
      <div className="seg2 act-effort-seg effort-switch">
        {EFFORTS.map((e) => (
          <button key={e} className={effort === e ? 'active' : ''} onClick={() => onEffort(e)}>
            <Icon name={EFFORT_ICON[e]} weight={effort === e ? 'fill' : undefined} />
            <span>{t.actEffortLevel[e]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Playful, escalating effort icons: a feather, an effort dial, a blaze. */
const EFFORT_ICON: Record<ActivityEffort, string> = {
  light: 'feather',
  moderate: 'gauge',
  hard: 'flame',
};

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
