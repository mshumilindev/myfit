/**
 * Long-term goal editor (Goals · design GL-04). Add or edit a measured,
 * time-boxed goal: a title, a measure (label + from/target/current), a horizon,
 * and the fine muscles it drives (which pre-seed grow focus and tie into volume,
 * suggestions and the radar). Live progress + a plain "how it shows up" read.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { useStore, addLongTermGoal, updateLongTermGoal, removeLongTermGoal } from '../store';
import { Sheet, Icon } from '../ui';
import { goalProgress, type LongTermGoal } from '../goals';
import { FOCUS_MUSCLES, focusToGroup, type FocusMuscle } from '../data/subregions';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function LongTermEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const existing = id ? store.goals.longTerm.find((g) => g.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [measure, setMeasure] = useState(existing?.measure.label ?? '');
  const [from, setFrom] = useState<string>(existing ? String(existing.measure.from) : '');
  const [to, setTo] = useState<string>(existing ? String(existing.measure.to) : '');
  const [current, setCurrent] = useState<string>(
    existing?.measure.current != null ? String(existing.measure.current) : '',
  );
  const [horizon, setHorizon] = useState<string>(existing ? String(existing.horizonMonths) : '6');
  const [drives, setDrives] = useState<FocusMuscle[]>(existing?.drivesMuscles ?? []);

  const label = (f: FocusMuscle) => t.subMuscleNames[f] ?? t.muscleGroups[focusToGroup(f)];
  const ready = title.trim().length > 0;

  const preview: LongTermGoal = {
    id: existing?.id ?? 'preview',
    title,
    horizonMonths: Number(horizon) || 0,
    startedAt: existing?.startedAt ?? 0,
    measure: {
      kind: 'custom',
      label: measure,
      from: Number(from) || 0,
      to: Number(to) || 0,
      current: current === '' ? undefined : Number(current),
    },
    drivesMuscles: drives,
    milestones: existing?.milestones ?? [],
  };
  const pct = Math.round(goalProgress(preview) * 100);

  const save = () => {
    if (!ready) return;
    if (existing) updateLongTermGoal(existing.id, preview);
    else addLongTermGoal({ ...preview, id: newId(), startedAt: Date.now() });
    onClose();
  };
  const del = () => {
    if (existing) removeLongTermGoal(existing.id);
    onClose();
  };

  return (
    <Sheet onClose={onClose} className="lt-sheet">
      <div className="sheet-head with-back">
        <button className="sheet-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="t">{t.ltNewTitle}</span>
      </div>

      <label className="bm-field">
        <span className="bm-field-label">{t.ltName}</span>
        <input
          className="input"
          autoFocus
          value={title}
          placeholder={t.ltNamePh}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="bm-field">
        <span className="bm-field-label">{t.ltMeasure}</span>
        <input
          className="input"
          value={measure}
          placeholder={t.ltMeasurePh}
          onChange={(e) => setMeasure(e.target.value)}
        />
      </label>

      <div className="lt-nums">
        <label className="bm-field">
          <span className="bm-field-label">{t.ltFrom}</span>
          <input className="input" type="number" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="bm-field">
          <span className="bm-field-label">{t.ltCurrent}</span>
          <input className="input" type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="bm-field">
          <span className="bm-field-label">{t.ltTarget}</span>
          <input className="input" type="number" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {current !== '' && to !== '' && from !== '' && (
        <div className="lt-progress">
          <div className="lt-progress-top">
            <span className="lt-pct">{pct}%</span>
            <span className="lt-to-target">{t.ltToTarget}</span>
          </div>
          <div className="lt-bar">
            <div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
        </div>
      )}

      <label className="bm-field">
        <span className="bm-field-label">{t.ltHorizon}</span>
        <input className="input" type="number" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
      </label>

      <div className="field-label">{t.ltDrives}</div>
      <div className="filter-chips">
        {FOCUS_MUSCLES.map((f) => (
          <button
            key={f}
            className={`fchip${drives.includes(f) ? ' active' : ''}`}
            onClick={() =>
              setDrives((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]))
            }
          >
            {label(f)}
          </button>
        ))}
      </div>

      {drives.length > 0 && (
        <div className="lt-how">
          <div className="lt-how-title">{t.ltHow}</div>
          <p>{t.ltHowBody}</p>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ minHeight: 48, fontSize: 15, marginTop: 'var(--space-3)' }}
        disabled={!ready}
        onClick={save}
      >
        {t.save}
      </button>
      {existing && (
        <button className="btn danger-outline lt-delete" onClick={del}>
          {t.ltDeleteGoal}
        </button>
      )}
    </Sheet>
  );
}
