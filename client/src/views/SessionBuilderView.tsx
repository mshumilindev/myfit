/**
 * Session Builder wizard. It opens on step 1 and walks the whole flow — physique
 * goal (only if unset), intent, muscles, the day's extras — regenerating the plan
 * live and ending on a Review of the full generated day. Start materialises it
 * into a live session; the gym is auto-chosen (nearest, else the usual one).
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { Shell } from '../App';
import { Icon } from '../ui';
import { useT } from '../i18n';
import {
  latestWeight,
  pickSessionGym,
  saveGeneratedDayAsProgram,
  startGeneratedDay,
  setPhysiqueTarget,
  useStore,
} from '../store';
import {
  buildDay,
  intentSpec,
  type BuildContext,
  type PlannedExercise,
  type SessionIntent,
} from '../sessionBuilder';
import { muscleReadiness, READINESS_COLOR } from '../recovery';
import { ARCHETYPES_BY_SEX, ARCHETYPES, type ArchetypeId } from '../goals';
import type { MuscleGroup } from '../data/exercises';
import { describeDay, dayReadoutLabel } from '../data/daySuggest';

const INTENTS: SessionIntent[] = ['strength', 'muscle', 'endurance', 'power', 'conditioning'];
const UPPER: MuscleGroup[] = [
  'chest',
  'lats',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
];
const LOWER: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves', 'lower_back', 'core'];

export function SessionBuilderView({
  shell,
  programMode,
  programDays,
  onClose,
}: {
  shell: Shell;
  programMode: 'none' | 'own' | 'other';
  programDays: number[];
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());
  // Gym is auto-selected (nearest by cached location, else the usual one) — no
  // manual gym step in the wizard.
  const [sessionGym] = useState(() => pickSessionGym());

  const [intent, setIntent] = useState<SessionIntent>('muscle');
  const [muscles, setMuscles] = useState<MuscleGroup[] | null>(null); // null = auto
  const [lengthMin, setLengthMin] = useState(60);
  const [warmup, setWarmup] = useState(true);
  const [cardio, setCardio] = useState(false);
  const [cooldown, setCooldown] = useState(true);

  const goalNeeded = !store.goals.physique;
  const steps = goalNeeded
    ? (['goal', 'intent', 'muscles', 'day', 'review'] as const)
    : (['intent', 'muscles', 'day', 'review'] as const);
  const [step, setStep] = useState(0); // always open on step 1 — the whole wizard, step by step

  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );
  const ctx: BuildContext = {
    finished,
    activities: store.activities,
    body: store.bodyMetrics,
    goals: store.goals,
    gym: sessionGym,
    now,
    intent,
    targetMuscles: muscles ?? undefined,
    lengthMin,
    warmup,
    cardio,
    cooldown,
    bodyKg: latestWeight(store.bodyMetrics)?.weight ?? null,
    sex: store.bodyMetrics.sex,
  };
  const day = useMemo(
    () => buildDay(ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      finished,
      store.activities,
      store.bodyMetrics,
      store.goals,
      intent,
      muscles,
      lengthMin,
      warmup,
      cardio,
      cooldown,
      now,
    ],
  );

  const ready = useMemo(() => muscleReadiness(finished, now), [finished, now]);
  const selected = muscles ?? day.targetMuscles;
  const cur = steps[step];

  const stepLabel: Record<string, string> = {
    goal: t.sbStepGoal,
    intent: t.sbStepIntent,
    muscles: t.sbStepMuscles,
    day: t.sbStepDay,
    review: t.sbStepReview,
  };
  const intentName: Record<SessionIntent, string> = {
    strength: t.sbIntentStrength,
    muscle: t.sbIntentMuscle,
    endurance: t.sbIntentEndurance,
    power: t.sbIntentPower,
    conditioning: t.sbIntentConditioning,
  };

  function toggleMuscle(m: MuscleGroup) {
    const base = muscles ?? day.targetMuscles;
    setMuscles(base.includes(m) ? base.filter((x) => x !== m) : [...base, m]);
  }

  function start() {
    const w = startGeneratedDay(day, sessionGym?.id ?? null);
    // Replace (not stack) the wizard, so discarding the session returns to Today.
    if (w) shell.replaceOverlay({ screen: 'session', workoutId: w.id });
  }

  const todayWeekday = ((new Date(now).getDay() + 6) % 7) + 1;
  const [selWd, setSelWd] = useState(todayWeekday);
  const [filled, setFilled] = useState<number[]>(programDays);
  const [saving, setSaving] = useState(false);
  const [savedWd, setSavedWd] = useState<number | null>(null);
  async function saveDay() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await saveGeneratedDayAsProgram(day, selWd, nameInput || derivedName);
      setFilled(res.days);
      setSavedWd(selWd);
    } finally {
      setSaving(false);
    }
  }
  const wdShort = (n: number) =>
    new Date(2024, 0, 1 + (n - 1)).toLocaleDateString(locale, { weekday: 'short' });
  const [nameInput, setNameInput] = useState('');
  const derivedName = useMemo(() => {
    const readout = describeDay(
      day.coverage.map((c) => [c.muscle, c.sets] as [MuscleGroup, number]),
    );
    return readout ? dayReadoutLabel(readout, t) : day.dayName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // ---- step bodies -------------------------------------------------------
  const goalBody = (
    <div className="sbw-body">
      <h2 className="sbw-q">{t.sbGoalQ}</h2>
      <div className="sbw-arche">
        {ARCHETYPES_BY_SEX(store.bodyMetrics.sex ?? 'male').map((id) => (
          <button
            key={id}
            className="sbw-arche-c"
            onClick={() => {
              setPhysiqueTarget({
                archetype: id as ArchetypeId,
                sex: ARCHETYPES[id].sex,
                setAt: Date.now(),
              });
              setStep(step + 1);
            }}
          >
            <span className="sbw-arche-ic">
              <Icon name="person" />
            </span>
            <b>{t.archetypes[id]?.name ?? id}</b>
            <span className="sbw-arche-b">{t.archetypes[id]?.blurb ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const intentBody = (
    <div className="sbw-body">
      <h2 className="sbw-q">{t.sbIntentQ}</h2>
      <div className="sbw-opts">
        {INTENTS.map((i) => {
          const sp = intentSpec(i);
          const on = i === intent;
          return (
            <button key={i} className={`sbw-opt${on ? ' on' : ''}`} onClick={() => setIntent(i)}>
              <span className="sbw-opt-txt">
                <b>{intentName[i]}</b>
                <span>
                  {sp.repLow}–{sp.repHigh} {t.sbReps}
                </span>
              </span>
              {on && <Icon name="check" className="sbw-opt-ck" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const musclesBody = (
    <div className="sbw-body">
      <div className="sbw-q-row">
        <h2 className="sbw-q">{t.sbMusclesQ}</h2>
        <button
          className={`sbw-auto${muscles === null ? ' on' : ''}`}
          onClick={() => setMuscles(null)}
        >
          <Icon name="robot" /> {t.sbAutoPick}
        </button>
      </div>
      {[UPPER, LOWER].map((group, gi) => (
        <div key={gi} className="sbw-mgroup">
          {group.map((m) => {
            const r = ready.get(m);
            const col = r ? READINESS_COLOR[r.state] : 'var(--color-neutral-600)';
            const on = selected.includes(m);
            return (
              <button
                key={m}
                className={`sbw-mchip${on ? ' on' : ''}`}
                style={on ? { boxShadow: `inset 0 0 0 1.5px ${col}` } : undefined}
                onClick={() => toggleMuscle(m)}
              >
                <span className="sbw-mdot" style={{ background: col }} />
                {t.muscleGroups[m]}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const seg = (val: number, opts: number[], set: (n: number) => void) => (
    <div className="sbw-seg">
      {opts.map((o) => (
        <button key={o} className={o === val ? 'on' : ''} onClick={() => set(o)}>
          {o}
        </button>
      ))}
    </div>
  );
  const toggle = (label: string, on: boolean, set: (b: boolean) => void, ic: string) => (
    <button className={`sbw-toggle${on ? ' on' : ''}`} onClick={() => set(!on)}>
      <Icon name={ic} />
      <span>{label}</span>
      <span className={`sbw-sw${on ? ' on' : ''}`}>
        <span className="sbw-knob" />
      </span>
    </button>
  );

  const dayBody = (
    <div className="sbw-body">
      <h2 className="sbw-q">{t.sbDayQ}</h2>
      <div className="sbw-field">
        <span className="section-title">{t.sbLengthLabel}</span>
        {seg(lengthMin, [30, 45, 60, 75, 90], setLengthMin)}
      </div>
      <div className="sbw-toggles">
        {toggle(t.sbWarmupOpt, warmup, setWarmup, 'flame')}
        {toggle(t.sbCardioOpt, cardio, setCardio, 'heartbeat')}
        {toggle(t.sbCooldownOpt, cooldown, setCooldown, 'wind')}
      </div>
    </div>
  );

  const exRow = (ex: PlannedExercise) => {
    const w =
      ex.targetWeight != null
        ? `${ex.targetWeight} ${t.kgCol.toLowerCase()}`
        : ex.kind === 'strength'
          ? '—'
          : '';
    const sr =
      ex.sets > 0 && ex.repHigh > 0
        ? `${ex.sets}×${ex.repLow}–${ex.repHigh}`
        : ex.durationMin
          ? `${ex.durationMin} ${t.sbMinShort}`
          : '';
    return (
      <div key={ex.name} className="sbw-ex">
        <span className="sbw-ex-ic">
          <Icon
            name={ex.kind === 'cardio' ? 'heartbeat' : ex.kind === 'strength' ? 'barbell' : 'wind'}
          />
        </span>
        <span className="sbw-ex-txt">
          <b>{ex.name}</b>
          <span className="sbw-ex-why">{ex.why}</span>
        </span>
        <span className="sbw-ex-meta">
          <span>{sr}</span>
          {w && <b>{w}</b>}
        </span>
      </div>
    );
  };

  const block = (label: string, list: PlannedExercise[]) =>
    list.length > 0 ? (
      <div className="sbw-block">
        <span className="section-title">{label}</span>
        {list.map(exRow)}
      </div>
    ) : null;

  const reviewBody = (
    <div className="sbw-body">
      <h2 className="sbw-q">{t.sbReviewQ}</h2>
      <div className="sbw-meta">
        <span className="mchip">{day.dayName}</span>
        <span className="mchip">
          {day.estMinutes} {t.sbMinShort}
        </span>
        <span className="mchip">
          {day.main.length} · {intentName[day.intent]}
        </span>
      </div>
      {block(t.sbWarmupOpt, day.warmup)}
      {block(t.sbStepReview === 'Review' ? 'Main' : t.sbStepDay, day.main)}
      {block(t.sbCardioOpt, day.cardio)}
      {block(t.sbCooldownOpt, day.cooldown)}
      {day.coverage.length > 0 && (
        <div className="sbw-block">
          <span className="section-title">{t.sbTodayCovers}</span>
          {day.coverage.slice(0, 6).map((c) => (
            <div key={c.muscle} className="sbw-cov">
              <span>{t.muscleGroups[c.muscle]}</span>
              <span className="sbw-cov-bar">
                <i style={{ width: `${Math.min(100, (c.sets / 8) * 100)}%` }} />
              </span>
              <span className="sbw-cov-n">{c.sets}</span>
            </div>
          ))}
        </div>
      )}
      {programMode !== 'other' && (
        <div className="sbw-block">
          <span className="section-title">{t.sbDayNameLabel}</span>
          <input
            className="sbw-name"
            type="text"
            value={nameInput}
            placeholder={derivedName}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <span className="section-title">{t.sbSaveOn}</span>
          <div className="sbw-wdrow">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                className={`sbw-wd${n === selWd ? ' on' : ''}${filled.includes(n) ? ' filled' : ''}`}
                onClick={() => setSelWd(n)}
              >
                {wdShort(n)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const bodyByStep: Record<string, ReactNode> = {
    goal: goalBody,
    intent: intentBody,
    muscles: musclesBody,
    day: dayBody,
    review: reviewBody,
  };

  return (
    <div className="screen sbw">
      <div className="sbw-head">
        <button className="sbw-x" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
        <span className="sbw-title">{t.sbwTitle}</span>
      </div>

      <div className="sbw-steps">
        {steps.map((s, i) => (
          <button
            key={s}
            className={`sbw-st${i <= step ? ' reached' : ''}`}
            onClick={() => setStep(i)}
            aria-current={i === step}
          >
            <span className={`sbw-cir${i === step ? ' on' : i < step ? ' done' : ''}`}>
              {i < step ? <Icon name="check" /> : i + 1}
            </span>
            <span className={`sbw-cap${i === step ? ' on' : ''}`}>{stepLabel[s]}</span>
          </button>
        ))}
      </div>

      <div className="sbw-scroll">{bodyByStep[cur]}</div>

      <div className="sbw-foot">
        {step > 0 ? (
          <button className="btn btn-secondary sbw-back" onClick={() => setStep(step - 1)}>
            <Icon name="caret-left" />
          </button>
        ) : null}
        {cur === 'review' ? (
          <>
            {programMode !== 'other' && (
              <button className="btn btn-secondary sbw-save" onClick={saveDay} disabled={saving}>
                {savedWd === selWd ? t.sbSaved : t.sbSaveDay}
              </button>
            )}
            <button className="btn btn-primary sbw-go" onClick={start}>
              {t.sbStartNow}
            </button>
          </>
        ) : (
          <button className="btn btn-primary sbw-go" onClick={() => setStep(step + 1)}>
            {stepLabel[steps[Math.min(step + 1, steps.length - 1)]]}
            <Icon name="caret-right" />
          </button>
        )}
      </div>
    </div>
  );
}
