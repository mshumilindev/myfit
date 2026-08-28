/**
 * Log activity (design feature 6, ACT-1): pick a cardio or recovery type. In
 * "start now" mode picking one begins a live, persisted timer on its own page
 * (ActivityView); in "log past" mode it opens a short backfill form. The live
 * timer itself is no longer in this sheet — it's a first-class screen.
 */
import { useState } from 'react';
import type { Shell } from '../App';
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import { startActivity, logActivity } from '../store';
import { ACTIVITY_TYPES, activityType, estimateCalories, type ActivityType } from '../activities';
import type { ActivityEffort } from '../types';
import { DateField, TimeField, DurationField } from './PickerFields';

const EFFORTS: ActivityEffort[] = ['light', 'moderate', 'hard'];

export function ActivitySheet(props: { shell: Shell; bodyKg: number | null; onClose: () => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<'now' | 'past'>('now');
  const [pastType, setPastType] = useState<string | null>(null);
  const type = pastType ? activityType(pastType) : null;

  function pick(key: string, category: 'conditioning' | 'recovery'): void {
    if (mode === 'now') {
      startActivity(key, category);
      props.shell.openOverlay({ screen: 'activity' });
      props.onClose();
    } else {
      setPastType(key);
    }
  }

  return (
    <Sheet onClose={props.onClose} className="activity-sheet">
      {type ? (
        <PastActivity
          type={type}
          bodyKg={props.bodyKg}
          onBack={() => setPastType(null)}
          onDone={props.onClose}
        />
      ) : (
        <div className="act-pick">
          <div className="act-head">
            <div className="act-title">
              <Icon name="heartbeat" />
              {t.logActivity}
            </div>
            <p className="act-cap">{t.actPickCap}</p>
          </div>
          <div className="seg2 act-mode-seg">
            <button className={mode === 'now' ? 'active' : ''} onClick={() => setMode('now')}>
              {t.actStartNow}
            </button>
            <button className={mode === 'past' ? 'active' : ''} onClick={() => setMode('past')}>
              {t.actLogPast}
            </button>
          </div>
          {(['conditioning', 'recovery'] as const).map((cat) => (
            <div key={cat} className="act-group">
              <div className="act-group-label">
                {cat === 'conditioning' ? t.actConditioning : t.actRecovery}
              </div>
              <div className="act-grid">
                {ACTIVITY_TYPES.filter((a) => a.category === cat).map((a) => (
                  <button
                    key={a.key}
                    className={`act-tile cat-${a.category}`}
                    onClick={() => pick(a.key, a.category)}
                  >
                    <Icon name={a.icon} />
                    <span>{t.actType[a.key] ?? a.key}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** Backfill form: log a past activity from a date, start time and duration. */
function PastActivity({
  type,
  bodyKg,
  onBack,
  onDone,
}: {
  type: ActivityType;
  bodyKg: number | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const [todayIso] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(30);
  const [effort, setEffort] = useState<ActivityEffort>('moderate');
  const [distance, setDistance] = useState('');

  const kcal = estimateCalories(type, duration, bodyKg, effort);

  function save(): void {
    const startedAt = new Date(`${date}T${time}`).getTime();
    if (Number.isNaN(startedAt)) return;
    logActivity({
      type: type.key,
      category: type.category,
      startedAt,
      finishedAt: startedAt + duration * 60000,
      durationMin: duration,
      calories: kcal,
      distanceKm: type.tracksDistance && distance ? Number(distance) || null : null,
      effort,
    });
    onDone();
  }

  return (
    <div className={`act-past cat-${type.category}`}>
      <div className="act-run-head">
        <button className="act-back" onClick={onBack} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="act-run-name">
          <Icon name={type.icon} />
          {t.actType[type.key] ?? type.key}
        </span>
      </div>

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
    </div>
  );
}
