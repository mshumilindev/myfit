/**
 * Body-metrics block for the profile page (AC Body metrics §2/§8).
 * Owner-editable: weigh-in hero, height + calculated BMI, a small weight-trend
 * chart with the goal line, a recent-entries list, and an optional composition
 * grid. Weigh-ins carry no notes. Read-only mode hides every edit control.
 */
import { useState } from 'react';
import {
  addWeight,
  bmiValue,
  editWeight,
  latestWeight,
  removeWeight,
  updateBodyMetrics,
  useStore,
} from '../store';
import type { BodyMetrics, WeightEntry } from '../types';
import { fmtBodyWeightKg, useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import { DateField, TimeField } from './PickerFields';

function isoOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
function hhmmOf(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function combine(iso: string, hhmm: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0).getTime();
}
function num(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

type SheetState = { kind: 'add' } | { kind: 'edit'; entry: WeightEntry } | null;

/** Editable numeric field with a unit suffix (or a static value when read-only). */
function MetricInput(props: {
  label: string;
  unit: string;
  value: number | null | undefined;
  readOnly: boolean;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(props.value != null ? String(props.value) : '');
  return (
    <div className="bm-metric">
      <div className="bm-metric-in">
        {props.readOnly ? (
          <span className="bm-metric-val">{props.value != null ? props.value : '—'}</span>
        ) : (
          <input
            className="input"
            inputMode="decimal"
            value={text}
            placeholder="—"
            onChange={(e) => setText(e.target.value)}
            onBlur={() => props.onCommit(num(text))}
          />
        )}
        <span className="bm-metric-unit">{props.unit}</span>
      </div>
      <div className="bm-metric-label">{props.label}</div>
    </div>
  );
}

/** SVG weight-trend chart with the goal line (last 8 entries). */
function TrendChart({
  entries,
  goal,
}: {
  entries: WeightEntry[];
  goal: number | null | undefined;
}) {
  const pts = entries.slice(-8);
  if (pts.length < 2) return null;
  const W = 320;
  const H = 96;
  const pad = 8;
  const ws = pts.map((p) => p.weight);
  const all = goal != null ? [...ws, goal] : ws;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const y = (w: number) => pad + (1 - (w - min) / span) * (H - pad * 2);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.weight)}`).join(' ');
  const goalY = goal != null ? y(goal) : null;
  return (
    <svg className="bm-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      {goalY != null && (
        <line x1={pad} y1={goalY} x2={W - pad} y2={goalY} className="bm-chart-goal" />
      )}
      <path d={line} className="bm-chart-line" />
      {pts.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(p.weight)} r={2.6} className="bm-chart-dot" />
      ))}
    </svg>
  );
}

export function BodyMetricsSection({
  readOnly,
  roleTag,
  data,
  showReadOnlyBadge = true,
}: {
  readOnly: boolean;
  /** e.g. "Admin · view" / "Trainer · view" for the read-only lock banner. */
  roleTag?: string;
  /** Another user's metrics for admin/trainer read-only view (§1/6a.4). When
   *  omitted the section shows the signed-in user's own store data. */
  data?: BodyMetrics;
  showReadOnlyBadge?: boolean;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const bm: BodyMetrics = data ?? store.bodyMetrics;
  const [sheet, setSheet] = useState<SheetState>(null);

  const latest = latestWeight(bm);
  const sorted = [...bm.weights].sort((a, b) => a.at - b.at);
  const first = sorted[0] ?? null;
  const deltaAll = latest && first ? latest.weight - first.weight : null;
  const toGoal = latest && bm.goalWeightKg != null ? latest.weight - bm.goalWeightKg : null;
  const bmi = bmiValue(bm.heightCm, latest?.weight);
  const bmiBand =
    bmi == null
      ? ''
      : bmi < 18.5
        ? t.bmBandUnder
        : bmi < 25
          ? t.bmBandNormal
          : bmi < 30
            ? t.bmBandOver
            : t.bmBandObese;

  const fmtDelta = (d: number) =>
    `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmtBodyWeightKg(Math.abs(d))}`;
  const fmtDateTime = (ts: number) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));

  return (
    <section className="profile-section bm-section">
      <div className="bm-head">
        <div className="field-label">{t.bmTitle}</div>
        {readOnly && showReadOnlyBadge && (
          <span className="bm-lock">
            <Icon name="lock-simple" />
            {roleTag ?? t.bmReadOnly}
          </span>
        )}
      </div>

      {latest ? (
        <div className="bm-hero">
          <div className="bm-hero-kicker">{t.bmCurrentWeight}</div>
          <div className="bm-hero-weight">{fmtBodyWeightKg(latest.weight)}</div>
          <div className="bm-hero-when">{fmtDateTime(latest.at)}</div>
          <div className="bm-hero-row">
            {deltaAll != null && deltaAll !== 0 && (
              <span className={`bm-delta${deltaAll < 0 ? ' down' : ' up'}`}>
                {fmtDelta(deltaAll)}
              </span>
            )}
            {toGoal != null && (
              <>
                <span className="bm-dot">·</span>
                <span className="bm-togoal">
                  {Math.abs(toGoal) < 0.05
                    ? t.bmAtGoal
                    : t.bmToGoal(fmtBodyWeightKg(Math.abs(toGoal)))}
                </span>
              </>
            )}
          </div>
          {!readOnly && (
            <button className="btn btn-primary bm-add" onClick={() => setSheet({ kind: 'add' })}>
              <Icon name="plus" />
              {t.bmAddWeight}
            </button>
          )}
        </div>
      ) : (
        <div className="bm-empty">
          <div className="bm-empty-t">{t.bmNoEntries}</div>
          <div className="bm-empty-b">{t.bmNoEntriesBody}</div>
          {!readOnly && (
            <button className="bm-empty-cta" onClick={() => setSheet({ kind: 'add' })}>
              {t.bmAddWeight}
            </button>
          )}
        </div>
      )}

      <div className="bm-two-up">
        <MetricInput
          label={t.bmHeight}
          unit="cm"
          value={bm.heightCm}
          readOnly={readOnly}
          onCommit={(v) => updateBodyMetrics({ heightCm: v })}
        />
        <div className="bm-metric bm-bmi">
          <div className="bm-metric-in">
            <span className="bm-metric-val">{bmi != null ? bmi.toFixed(1) : '—'}</span>
            {bmiBand && <span className="bm-bmi-band">{bmiBand}</span>}
          </div>
          <div className="bm-metric-label">
            {t.bmBmi} · {t.bmApprox}
          </div>
        </div>
      </div>

      {sorted.length >= 2 && (
        <div className="bm-trend">
          <div className="bm-trend-head">
            <span className="section-label">{t.bmWeightTrend}</span>
            <span className="bm-trend-sub">{t.bmLastN(Math.min(8, sorted.length))}</span>
          </div>
          <TrendChart entries={sorted} goal={bm.goalWeightKg} />
          <div className="bm-trend-foot">
            <span>{fmtDateTime(latest!.at)}</span>
            {bm.goalWeightKg != null && <span>{t.bmGoalKg(fmtBodyWeightKg(bm.goalWeightKg))}</span>}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="bm-entries">
          <div className="section-label">{t.bmRecent}</div>
          {[...sorted].reverse().map((e, i, arr) => {
            const prev = arr[i + 1];
            const d = prev ? e.weight - prev.weight : null;
            return (
              <div key={e.id} className="bm-entry">
                <span className="bm-entry-date">{fmtDateTime(e.at)}</span>
                <span className="bm-entry-w">{fmtBodyWeightKg(e.weight)}</span>
                {d != null && d !== 0 ? (
                  <span className={`bm-entry-d${d < 0 ? ' down' : ' up'}`}>{fmtDelta(d)}</span>
                ) : (
                  <span className="bm-entry-d muted">—</span>
                )}
                {!readOnly && (
                  <button
                    className="bm-entry-edit"
                    aria-label={t.bmEditWeight}
                    onClick={() => setSheet({ kind: 'edit', entry: e })}
                  >
                    <Icon name="pencil-simple" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bm-comp">
        <div className="section-label">{t.bmComposition}</div>
        <div className="bm-comp-grid">
          <MetricInput
            label={t.bmBodyFat}
            unit="%"
            value={bm.bodyFatPct}
            readOnly={readOnly}
            onCommit={(v) => updateBodyMetrics({ bodyFatPct: v })}
          />
          <MetricInput
            label={t.bmMuscle}
            unit="kg"
            value={bm.muscleKg}
            readOnly={readOnly}
            onCommit={(v) => updateBodyMetrics({ muscleKg: v })}
          />
          <MetricInput
            label={t.bmGoal}
            unit="kg"
            value={bm.goalWeightKg}
            readOnly={readOnly}
            onCommit={(v) => updateBodyMetrics({ goalWeightKg: v })}
          />
          <MetricInput
            label={t.bmWaist}
            unit="cm"
            value={bm.waistCm}
            readOnly={readOnly}
            onCommit={(v) => updateBodyMetrics({ waistCm: v })}
          />
          <MetricInput
            label={t.bmChest}
            unit="cm"
            value={bm.chestCm}
            readOnly={readOnly}
            onCommit={(v) => updateBodyMetrics({ chestCm: v })}
          />
          <MetricInput
            label={t.bmHip}
            unit="cm"
            value={bm.hipCm}
            readOnly={readOnly}
            onCommit={(v) => updateBodyMetrics({ hipCm: v })}
          />
        </div>
      </div>

      {sheet && <WeightSheet state={sheet} onClose={() => setSheet(null)} />}
    </section>
  );
}

export function WeightSheet({
  state,
  onClose,
}: {
  state: Exclude<SheetState, null>;
  onClose: () => void;
}) {
  const { t } = useT();
  const editing = state.kind === 'edit' ? state.entry : null;
  const [nowTs] = useState(() => Date.now());
  const [weight, setWeight] = useState(editing ? String(editing.weight) : '');
  const initTs = editing ? editing.at : nowTs;
  const [iso, setIso] = useState(() => isoOf(initTs));
  const [hhmm, setHhmm] = useState(() => hhmmOf(initTs));

  const w = num(weight);
  const save = () => {
    if (w == null || w <= 0) return;
    const at = combine(iso, hhmm);
    if (editing) editWeight(editing.id, w, at);
    else addWeight(w, at);
    onClose();
  };

  return (
    <Sheet onClose={onClose} className="bm-sheet">
      <h3 className="bm-sheet-title">{editing ? t.bmEditWeight : t.bmAddWeight}</h3>
      <label className="bm-field">
        <span className="bm-field-label">{t.bmWeight}</span>
        <div className="bm-field-in">
          <input
            className="input"
            inputMode="decimal"
            autoFocus
            value={weight}
            placeholder="—"
            onChange={(e) => setWeight(e.target.value)}
          />
          <span className="bm-field-unit">{'kg'}</span>
        </div>
      </label>
      <div className="bm-field-row">
        <label className="bm-field">
          <span className="bm-field-label">{t.bmDate}</span>
          <DateField value={iso} onChange={setIso} max={isoOf(nowTs)} />
        </label>
        <label className="bm-field">
          <span className="bm-field-label">{t.bmTime}</span>
          <TimeField value={hhmm} onChange={setHhmm} />
        </label>
      </div>
      <div className="bm-sheet-actions">
        {editing && (
          <button
            className="bm-remove"
            onClick={() => {
              removeWeight(editing.id);
              onClose();
            }}
          >
            <Icon name="trash" />
            {t.bmRemove}
          </button>
        )}
        <button className="btn btn-primary grow" disabled={w == null || w <= 0} onClick={save}>
          {t.save}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Blocking profile-completion gate (Body v1 §3.2). A returning user missing the
 * required metrics (height + a current weight) sees this full-screen instead of
 * the app until both are filled. Framed as setup continuation, never an error —
 * calm graphite/brass, no red, positive copy.
 */
export function ProfileCompletionGate() {
  const { t } = useT();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [nowTs] = useState(() => Date.now());

  const h = num(height);
  const w = num(weight);
  const ready = h != null && h > 0 && w != null && w > 0;

  const finish = () => {
    if (!ready) return;
    updateBodyMetrics({ heightCm: h });
    addWeight(w, nowTs);
  };

  return (
    <div className="body-gate">
      <div className="body-gate-brand">
        <Icon name="barbell" />
        <span>{t.appName}</span>
      </div>
      <div className="body-gate-body">
        <span className="body-gate-badge">
          <Icon name="ruler" />
        </span>
        <h1 className="body-gate-title">{t.bmGateTitle}</h1>
        <p className="body-gate-lead">{t.bmGateLead}</p>
        <div className="body-gate-fields">
          <label className="bm-field">
            <span className="bm-field-label">{t.bmHeight}</span>
            <div className="bm-field-in">
              <input
                className="input"
                inputMode="numeric"
                autoFocus
                value={height}
                placeholder="178"
                onChange={(e) => setHeight(e.target.value)}
              />
              <span className="bm-field-unit">{'cm'}</span>
            </div>
          </label>
          <label className="bm-field">
            <span className="bm-field-label">{t.bmGateWeight}</span>
            <div className="bm-field-in">
              <input
                className="input"
                inputMode="decimal"
                value={weight}
                placeholder="84.0"
                onChange={(e) => setWeight(e.target.value)}
              />
              <span className="bm-field-unit">{'kg'}</span>
            </div>
          </label>
        </div>
      </div>
      <div className="body-gate-foot">
        <button className="btn btn-primary" disabled={!ready} onClick={finish}>
          {t.bmGateDone}
        </button>
        <p className="body-gate-note">{t.bmGateNote}</p>
      </div>
    </div>
  );
}
