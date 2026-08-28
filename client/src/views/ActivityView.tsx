/**
 * Live activity page (design feature 6, ACT-2): a persisted, resumable timer —
 * a first-class screen like a session, not a sheet. Closing it keeps the
 * activity running; only Discard removes it. Time and calories tick up live;
 * effort and distance are optional and saved as you go.
 */
import { useEffect, useState } from 'react';
import {
  useStore,
  latestWeight,
  liveActivity,
  pauseActivity,
  resumeActivity,
  updateActivity,
  finishActivity,
  discardActivity,
} from '../store';
import { useT } from '../i18n';
import { ConfirmDialog, Icon } from '../ui';
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

export function ActivityView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const activity = liveActivity();
  const [now, setNow] = useState(() => Date.now());
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const running = !!activity && !isActivityPaused(activity);

  // Tick once a second while running so the clock and calories climb live.
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [running]);

  // If the activity vanished (finished/discarded elsewhere), leave the page.
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

  function finish(): void {
    if (activity) finishActivity(activity.id, { calories: kcal });
    onClose();
  }

  return (
    <div className={`screen activity-screen cat-${activity.category}`}>
      <div className="av-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="av-head-name">
          <Icon name={type?.icon ?? 'heartbeat'} />
          {t.actType[activity.type] ?? activity.type}
        </span>
        <span className={`act-cat-badge cat-${activity.category}`}>
          <Icon name={isRecovery ? 'wave-sine' : 'lightning'} weight="fill" />
          {isRecovery ? t.actCountsRecovery : t.actAddsConditioning}
        </span>
      </div>

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

        <div className="av-effort">
          <span className="act-field-label">{t.actEffort}</span>
          <div className="seg2 act-effort-seg">
            {EFFORTS.map((e) => (
              <button
                key={e}
                className={effort === e ? 'active' : ''}
                onClick={() => updateActivity(activity.id, { effort: e })}
              >
                {t.actEffortLevel[e]}
              </button>
            ))}
          </div>
        </div>

        {type?.tracksDistance && (
          <label className="act-field av-distance">
            <span>{t.actDistance}</span>
            <div className="act-min">
              <input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                placeholder="0.0"
                value={activity.distanceKm ?? ''}
                onChange={(e) =>
                  updateActivity(activity.id, {
                    distanceKm: e.target.value === '' ? null : Number(e.target.value) || null,
                  })
                }
              />
              <em>{t.kmShort}</em>
            </div>
          </label>
        )}
      </div>

      <div className="av-actions">
        <button
          className="btn btn-secondary av-pause"
          onClick={() => (paused ? resumeActivity(activity.id) : pauseActivity(activity.id))}
        >
          <Icon name={paused ? 'play' : 'timer'} weight="fill" />
          {paused ? t.actResume : t.actPause}
        </button>
        <button className="btn btn-primary av-finish" disabled={minutes <= 0} onClick={finish}>
          <Icon name="check" weight="bold" />
          {t.actFinish}
        </button>
      </div>
      <button className="av-discard" onClick={() => setConfirmDiscard(true)}>
        <Icon name="trash" />
        {t.actDiscard}
      </button>

      {confirmDiscard && (
        <ConfirmDialog
          title={t.actDiscardTitle}
          body={t.actDiscardBody}
          confirmLabel={t.actDiscard}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            discardActivity(activity.id);
            setConfirmDiscard(false);
            onClose();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}
