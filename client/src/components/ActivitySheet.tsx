/**
 * Log activity (design feature 6, ACT-1..4): pick a cardio or recovery type,
 * then either run a live timer with calories ticking up, or backfill a past one
 * from a duration. Conditioning adds load; recovery reads rest-blue. Without a
 * body weight, calories degrade to a soft prompt — never a hard block.
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import { logActivity } from '../store';
import { ACTIVITY_TYPES, activityType, estimateCalories, type ActivityType } from '../activities';
import type { ActivityEffort } from '../types';

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function ActivitySheet(props: {
  bodyKg: number | null;
  onClose: () => void;
  onAddWeight?: () => void;
}) {
  const { t } = useT();
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const type = typeKey ? activityType(typeKey) : null;

  return (
    <Sheet onClose={props.onClose} className="activity-sheet">
      {type ? (
        <RunActivity
          type={type}
          bodyKg={props.bodyKg}
          onBack={() => setTypeKey(null)}
          onAddWeight={props.onAddWeight}
          onDone={props.onClose}
        />
      ) : (
        <PickActivity t={t} onPick={setTypeKey} />
      )}
    </Sheet>
  );
}

function PickActivity({
  t,
  onPick,
}: {
  t: ReturnType<typeof useT>['t'];
  onPick: (key: string) => void;
}) {
  const groups = [
    { cat: 'conditioning' as const, label: t.actConditioning },
    { cat: 'recovery' as const, label: t.actRecovery },
  ];
  return (
    <div className="act-pick">
      <div className="act-head">
        <div className="act-title">
          <Icon name="heartbeat" />
          {t.logActivity}
        </div>
        <p className="act-cap">{t.actPickCap}</p>
      </div>
      {groups.map((g) => (
        <div key={g.cat} className="act-group">
          <div className="act-group-label">{g.label}</div>
          <div className="act-grid">
            {ACTIVITY_TYPES.filter((a) => a.category === g.cat).map((a) => (
              <button
                key={a.key}
                className={`act-tile cat-${a.category}`}
                onClick={() => onPick(a.key)}
              >
                <Icon name={a.icon} />
                <span>{t.actType[a.key] ?? a.key}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RunActivity({
  type,
  bodyKg,
  onBack,
  onAddWeight,
  onDone,
}: {
  type: ActivityType;
  bodyKg: number | null;
  onBack: () => void;
  onAddWeight?: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const isRecovery = type.category === 'recovery';
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [effort, setEffort] = useState<ActivityEffort>('moderate');
  const [distance, setDistance] = useState('');
  const [manual, setManual] = useState(false);
  const [manualMin, setManualMin] = useState(30);

  // Live clock — ticks only while the timer is the active mode.
  useEffect(() => {
    if (manual) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [manual]);

  const elapsedMs = now - startedAt;
  const minutes = manual ? manualMin : elapsedMs / 60000;
  const kcal = useMemo(
    () => estimateCalories(type, minutes, bodyKg, effort),
    [type, minutes, bodyKg, effort],
  );

  function save(): void {
    const min = Math.max(0, minutes);
    if (min <= 0) return;
    const finishedAt = manual ? startedAt : Date.now();
    logActivity({
      type: type.key,
      category: type.category,
      startedAt: manual ? finishedAt - min * 60000 : startedAt,
      finishedAt,
      durationMin: min,
      calories: estimateCalories(type, min, bodyKg, effort),
      distanceKm: type.tracksDistance && distance ? Number(distance) || null : null,
      effort,
    });
    onDone();
  }

  return (
    <div className={`act-run cat-${type.category}`}>
      <div className="act-run-head">
        <button className="act-back" onClick={onBack} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="act-run-name">
          <Icon name={type.icon} />
          {t.actType[type.key] ?? type.key}
        </span>
        <span className={`act-cat-badge cat-${type.category}`}>
          <Icon name={isRecovery ? 'wave-sine' : 'lightning'} weight="fill" />
          {isRecovery ? t.actCountsRecovery : t.actAddsConditioning}
        </span>
      </div>

      {!manual ? (
        <div className="act-timer">
          <div className="act-clock tnum">{mmss(elapsedMs)}</div>
          {kcal != null ? (
            <div className="act-kcal">
              <Icon name="flame" weight="fill" />
              <span className="tnum">~{kcal}</span>
              <em>{t.kcalShort}</em>
            </div>
          ) : (
            <button className="act-noweight" onClick={() => onAddWeight?.()}>
              <Icon name="scales" />
              <span>{t.actNoWeight}</span>
              {onAddWeight && <Icon name="caret-right" />}
            </button>
          )}
        </div>
      ) : (
        <div className="act-manual">
          <label className="act-field">
            <span>{t.actDuration}</span>
            <div className="act-min">
              <input
                type="number"
                min={1}
                max={480}
                value={manualMin}
                onChange={(e) =>
                  setManualMin(Math.max(1, Math.min(480, Number(e.target.value) || 0)))
                }
              />
              <em>{t.minShort}</em>
            </div>
          </label>
          {kcal != null && (
            <div className="act-kcal sm">
              <Icon name="flame" weight="fill" />
              <span className="tnum">~{kcal}</span>
              <em>{t.kcalShort}</em>
            </div>
          )}
        </div>
      )}

      <div className="act-effort">
        <span className="act-field-label">{t.actEffort}</span>
        <div className="seg2 act-effort-seg">
          {EFFORTS.map((e) => (
            <button key={e} className={effort === e ? 'active' : ''} onClick={() => setEffort(e)}>
              {t.actEffortLevel[e]}
            </button>
          ))}
        </div>
      </div>

      {type.tracksDistance && (
        <label className="act-field act-distance">
          <span>{t.actDistance}</span>
          <div className="act-min">
            <input
              type="number"
              min={0}
              step="0.1"
              inputMode="decimal"
              placeholder="0.0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
            <em>{t.kmShort}</em>
          </div>
        </label>
      )}

      <div className="act-run-actions">
        <button
          className="btn btn-secondary act-manual-toggle"
          onClick={() => setManual((m) => !m)}
        >
          <Icon name="clock-counter-clockwise" />
          {manual ? t.actUseTimer : t.actLogPast}
        </button>
        <button className="btn btn-primary" disabled={minutes <= 0} onClick={save}>
          <Icon name="check" weight="bold" />
          {manual ? t.actSave : t.actFinish}
        </button>
      </div>
    </div>
  );
}
