/**
 * Circuit rendering (Circuit chunk): the round-based block of a circuit, its run sheet and the exercise card. Moved out of the
 * session screen so the base carries none of it; the core draws these only through `circuitHost` while Circuit is installed.
 */
import { useEffect, useState } from 'react';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { Exercise, SetEntry } from '../types';
import type { CircuitBlockProps, CircuitRunSheetProps } from '../circuitApi';
import { exerciseVolumeKg, groupRounds, loadTypeFor } from '../store';
import { MuscleChip, MUSCLE_IDS } from '../components/Muscle';
import { fmtWeightValue } from '../fmtWeight';
import { type MuscleGroup } from '../data/exercises';
import { fmtTonnes, useT } from '../i18n';
import { useExerciseName, Icon, Sheet } from '../ui';
import { STRINGS } from './strings';
// ---------------------------------------------------------------------------
// F3 · Circuit rendering (design CR-03 … CR-07)
// ---------------------------------------------------------------------------

function circuitPrimaryMuscle(ex: Exercise): MuscleGroup | null {
  const m = ex.primaryMuscle;
  if (m && (MUSCLE_IDS as readonly string[]).includes(m)) return m as MuscleGroup;
  const s = (ex.secondaryMuscles ?? []).find((x) => (MUSCLE_IDS as readonly string[]).includes(x));
  return (s as MuscleGroup) ?? null;
}

function circuitMuscleChips(
  ex: Exercise,
  onMuscle: (m: MuscleGroup) => void,
  opts?: { icon?: boolean; max?: number },
) {
  const primary = circuitPrimaryMuscle(ex);
  const secondary = (ex.secondaryMuscles ?? [])
    .filter((x) => (MUSCLE_IDS as readonly string[]).includes(x) && x !== primary)
    .slice(0, opts?.max ?? 1) as MuscleGroup[];
  return (
    <>
      {primary && (
        <MuscleChip
          muscle={primary}
          tone="primary"
          variant="pill"
          icon={opts?.icon}
          onClick={onMuscle}
          detail
        />
      )}
      {secondary.map((m) => (
        <MuscleChip key={m} muscle={m} tone="secondary" variant="pill" onClick={onMuscle} detail />
      ))}
    </>
  );
}

export function CircuitBlock(props: CircuitBlockProps) {
  const { t, locale } = useT();
  const cs = STRINGS[locale];
  const exName = useExerciseName();
  const [expanded, setExpanded] = useState(false);
  const g = props.group;
  const rounds = groupRounds(g);
  const doneRounds = Math.min(...g.exercises.map((e) => e.sets.length));
  const complete = doneRounds >= rounds;
  const summary = !props.building && (props.past || complete);
  const letter = g.letter;
  const totalKg = g.exercises.reduce((v, e) => v + exerciseVolumeKg(e), 0);
  // CR-11 · a finished circuit that isn't the last block collapses to a slim
  // done-bar; the just-finished one (last block) and history stay expanded.
  const slim = summary && !props.past && !props.isLast && !expanded;

  // CR-02 · building the circuit (mode active) — a plain list, rounds control
  // and the "Done — start" CTA. The loop wash lives in the top banner instead.
  if (props.building) {
    const buildRounds = props.rounds ?? rounds;
    return (
      <div className="circuit-building">
        <div className="section-label cbld-label">{cs.circuitBuilding}</div>
        {g.exercises.map((e, i) => (
          <div key={e.id} className="cbld-row">
            <span className="cb-slot">
              {letter}
              {i + 1}
            </span>
            <div className="cbld-main">
              <div className="cbld-name">{exName(e.name)}</div>
              <div className="cbld-mus">{circuitMuscleChips(e, props.onMuscle)}</div>
            </div>
            <Icon name="list" className="cbld-drag" />
          </div>
        ))}
        <div className="cbld-rounds">
          <Icon name="arrows-clockwise" className="cbld-loopi" />
          <span className="cbld-rlabel">{cs.circuitRounds}</span>
          <div className="cbld-stepper">
            <IconButton
              icon="minus-circle"
              size="sm"
              label="-"
              onClick={() => props.onRounds?.(-1)}
            />
            <span className="num">{buildRounds}</span>
            <IconButton
              icon="plus-circle"
              size="sm"
              label="+"
              onClick={() => props.onRounds?.(1)}
            />
          </div>
        </div>
        <Button variant="secondary" className="cbld-add" onClick={props.onAddAnother}>
          <Icon name="plus" weight="bold" />
          {cs.circuitAddAnother}
        </Button>
        <Button variant="primary" className="cbld-done" onClick={props.onDoneBuilding}>
          <Icon name="check-circle" />
          {cs.circuitDoneStart(letter)}
        </Button>
      </div>
    );
  }

  if (slim) {
    return (
      <Card
        as="button"
        pad="sm"
        emphasis="quiet"
        className="circuit-block donebar"
        onClick={() => setExpanded(true)}
      >
        <span className="loop sm off">
          <Icon name="arrows-clockwise" />
        </span>
        <div className="cb-htext">
          <div className="cb-tag">
            <span className="cb-name off">{t.circuitTitle(letter)}</span>
            <span className="cb-dot">·</span>
            <span className="cb-done-tag">{cs.circuitStatusDone}</span>
          </div>
          <div className="cb-meta">
            {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
          </div>
        </div>
        <Icon name="check-circle" weight="fill" className="cb-donecheck" />
      </Card>
    );
  }

  if (summary) {
    return (
      <div className="circuit-block done">
        <span className="cb-spine" />
        <div className="cb-inner">
          <div className="cb-head">
            <span className="loop sm">
              <Icon name="arrows-clockwise" />
            </span>
            <div className="cb-htext">
              <div className="cb-tag">
                <span className="cb-name">{t.circuitTitle(letter)}</span>
                <span className="cb-dot">·</span>
                <span className="cb-done-tag">{cs.circuitStatusDone}</span>
              </div>
              <div className="cb-meta">
                {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
              </div>
            </div>
            {props.past && totalKg > 0 && <span className="cb-vol num">{fmtTonnes(totalKg)}</span>}
            {!props.past && !props.isLast && (
              <IconButton
                icon="caret-up"
                size="sm"
                className="cb-collapse"
                label={t.navCollapse}
                onClick={() => setExpanded(false)}
              />
            )}
          </div>
          <div className="cb-didhead">
            <span className="section-label">{cs.circuitWhatYouDid}</span>
            {!complete && (
              <Button variant="secondary" className="cb-continue" onClick={props.onRun}>
                <Icon name="arrow-counter-clockwise" />
                {cs.circuitContinueCircuit}
              </Button>
            )}
          </div>
          <div className="cb-summary">
            {g.exercises.map((e, i) => (
              <div key={e.id} className="cb-srow">
                <div className="cb-sline">
                  <span className="cb-slot">
                    {letter}
                    {i + 1}
                  </span>
                  <span className="cb-sname">{exName(e.name)}</span>
                  <span className="cb-scount num">
                    {t.circuitNRoundsShort(Math.min(e.sets.length, rounds), rounds)}
                  </span>
                </div>
                <div className="cb-plates">
                  {Array.from({ length: rounds }).map((_, r) => {
                    const st = e.sets[r];
                    const on = !!st;
                    const val = st
                      ? st.weight != null
                        ? `${st.reps}×${fmtWeightValue(st.weight)}`
                        : `${st.reps}`
                      : '—';
                    return (
                      <div key={r} className={`rplate${on ? ' on' : ''}`}>
                        <span className="rplate-r">R{r + 1}</span>
                        <span className="rplate-v num">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="circuit-block">
      <span className="cb-spine" />
      <div className="cb-inner">
        <div className="cb-head">
          <span className="loop sm">
            <Icon name="arrows-clockwise" />
          </span>
          <div className="cb-htext">
            <div className="cb-tag">
              <span className="cb-name">{t.circuitTitle(letter)}</span>
            </div>
            <div className="cb-meta">
              {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
            </div>
          </div>
          <div className="cb-counter">
            <span className="num">{t.circuitNRoundsShort(doneRounds, rounds)}</span>
            <span className="cb-counter-lbl">{cs.circuitRoundsShort}</span>
          </div>
        </div>
        <div className="cb-pips">
          {Array.from({ length: rounds }).map((_, r) => (
            <span
              key={r}
              className={`pip${r < doneRounds ? ' done' : r === doneRounds ? ' active' : ''}`}
            />
          ))}
        </div>
        <div className="cb-list">
          {g.exercises.map((e, i) => (
            <div key={e.id} className="cb-row">
              <span className="cb-slot">
                {letter}
                {i + 1}
              </span>
              <span className="cb-rname">{exName(e.name)}</span>
              <span className="cb-rmus">{circuitMuscleChips(e, props.onMuscle)}</span>
            </div>
          ))}
        </div>
        <Button variant="primary" className="cb-cta" onClick={props.onRun}>
          <Icon name="play" />
          {doneRounds === 0 ? cs.circuitStart : cs.circuitContinueRound(doneRounds + 1)}
        </Button>
      </div>
    </div>
  );
}

export function CircuitRunSheet(props: CircuitRunSheetProps) {
  const { t, locale } = useT();
  const cs = STRINGS[locale];
  const exName = useExerciseName();
  const g = props.group;
  const rounds = groupRounds(g);
  const letter = g.letter;
  const startRound = Math.min(rounds - 1, Math.min(...g.exercises.map((e) => e.sets.length)));
  const [roundIdx, setRoundIdx] = useState(Math.max(0, startRound));
  const firstUnlogged = g.exercises.findIndex((e) => e.sets.length <= startRound);
  const [exIdx, setExIdx] = useState(firstUnlogged < 0 ? 0 : firstUnlogged);
  // CR-10 · between-rounds panel: the round number just completed (null = running).
  const [roundDone, setRoundDone] = useState<number | null>(null);
  const [restSec, setRestSec] = useState(0);

  useEffect(() => {
    if (roundDone == null) return;
    const id = setInterval(() => setRestSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [roundDone]);

  const n = g.exercises.length;
  const cur = g.exercises[Math.min(exIdx, n - 1)];
  const loggedThisRound = (i: number) => g.exercises[i].sets.length > roundIdx;
  const curLogged = loggedThisRound(exIdx);
  const weighted = loadTypeFor(cur) === 'weight';

  const prevSet = cur.sets[cur.sets.length - 1];
  const goalReps = cur.plannedReps ?? prevSet?.reps ?? 10;
  const seedReps = prevSet?.reps ?? cur.plannedReps ?? 10;
  const seedWeight = prevSet?.weight ?? null;

  const recorded = curLogged ? cur.sets[roundIdx] : undefined;
  const nextEx = (() => {
    for (let k = 1; k <= n; k++) {
      const i = (exIdx + k) % n;
      if (i !== exIdx && !loggedThisRound(i)) return { ex: g.exercises[i], i };
    }
    return null;
  })();

  function advance(justLogged: number) {
    for (let k = 1; k <= n; k++) {
      const i = (justLogged + k) % n;
      if (i !== justLogged && !loggedThisRound(i)) {
        setExIdx(i);
        return;
      }
    }
  }

  function completeRound() {
    setRestSec(0);
    setRoundDone(roundIdx + 1);
  }

  function startNextRound() {
    const next = roundDone ?? roundIdx + 1;
    if (next + 1 > rounds) props.onSetRounds(next + 1);
    setRoundIdx(next);
    setExIdx(0);
    setRoundDone(null);
  }

  const fmtRest = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  // CR-10 · between-rounds panel ------------------------------------------
  if (roundDone != null) {
    const doneCount = g.exercises.filter((e) => e.sets.length >= roundDone).length;
    return (
      <Sheet className="circuit-run cr-between" onClose={props.onClose}>
        <div className="crb-body">
          <span className="crb-check">
            <Icon name="check-circle" weight="fill" />
          </span>
          <div className="crb-title">{cs.circuitRoundComplete(roundDone)}</div>
          <div className="crb-sub">
            {cs.circuitAllLogged(doneCount)} {cs.circuitRoundCompleteBody}
          </div>
          <div className="crb-pips">
            {Array.from({ length: rounds }).map((_, r) => (
              <span
                key={r}
                className={`pip${r < roundDone ? ' done' : r === roundDone ? ' active' : ''}`}
              />
            ))}
            <span className="pip open">
              <Icon name="plus" weight="bold" />
            </span>
          </div>
          <div className="crb-openlbl">
            {t.circuitNRoundsShort(roundDone, rounds)} · <span>{cs.circuitRoundsOpen}</span>
          </div>
          <div className="crb-rest">
            <Icon name="timer" />
            <span className="crb-rest-lbl">{cs.circuitRest}</span>
            <span className="crb-rest-num num">{fmtRest(restSec)}</span>
          </div>
        </div>
        <div className="crb-actions">
          <Button variant="primary" className="cr-log" onClick={startNextRound}>
            <Icon name="play" />
            {cs.circuitStartRound(roundDone + 1)}
          </Button>
          <div className="crb-actions-row">
            <Button
              variant="secondary"
              className="cr-finish"
              onClick={() => props.onSetRounds(rounds + 1)}
            >
              <Icon name="plus" weight="bold" />
              {cs.circuitAddRound}
            </Button>
            <Button variant="secondary" className="cr-finish" onClick={props.onClose}>
              <Icon name="flag-checkered" />
              {cs.circuitFinishAll}
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet className="circuit-run" onClose={props.onClose}>
      <div className="cr-loophead">
        <span className="loop">
          <Icon name="arrows-clockwise" />
        </span>
        <div className="cr-lh-text">
          <div className="cr-lh-tag">{t.circuitTitle(letter)}</div>
          <div className="cr-lh-round">{cs.circuitRoundOf(roundIdx + 1, rounds)}</div>
        </div>
        <div className="cr-pips">
          {Array.from({ length: rounds }).map((_, r) => (
            <span
              key={r}
              className={`pip${r < roundIdx ? ' done' : r === roundIdx ? ' active' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="cr-nav">
        <IconButton
          icon="caret-left"
          variant="secondary"
          size="sm"
          shape="round"
          className="cr-arrow"
          disabled={exIdx === 0}
          label={t.navPrev}
          onClick={() => setExIdx(Math.max(0, exIdx - 1))}
        />
        <div className="cr-nav-mid">
          <div className="cr-dots">
            {g.exercises.map((e, i) => (
              <span
                key={e.id}
                className={`crb-pos${i === exIdx ? ' active' : loggedThisRound(i) ? ' done' : ''}`}
              />
            ))}
          </div>
          <div className="cr-nav-lbl">{cs.circuitExerciseOf(exIdx + 1, n)}</div>
        </div>
        <IconButton
          icon="caret-right"
          variant="secondary"
          size="sm"
          shape="round"
          className="cr-arrow"
          disabled={exIdx >= n - 1}
          label={t.navNext}
          onClick={() => setExIdx(Math.min(n - 1, exIdx + 1))}
        />
      </div>

      <div className="cr-stage">
        {recorded ? (
          <div className="cr-card recorded">
            <div className="cr-card-head">
              <span className="slot ok">
                {letter}
                {exIdx + 1}
              </span>
              <span className="cr-card-name">{exName(cur.name)}</span>
              <Icon name="check-circle" weight="fill" className="cr-ok" />
            </div>
            <div className="cr-mus">{circuitMuscleChips(cur, props.onMuscle, { icon: true })}</div>
            <div className="cr-recorded">
              <Icon name="check-circle" weight="fill" />
              <span className="cr-rec-text">
                {cs.circuitRecorded} ·{' '}
                <span className="num">
                  {recorded.weight != null
                    ? `${recorded.reps} × ${fmtWeightValue(recorded.weight)} ${t.kgCol.toLowerCase()}`
                    : `${recorded.reps} ${t.chUnit.reps}`}
                </span>
              </span>
            </div>
            {nextEx && (
              <div className="cr-next">
                <span className="cr-next-slot num">
                  {letter}
                  {nextEx.i + 1}
                </span>
                <span className="cr-next-name">
                  {cs.circuitNext} · {nextEx.ex.name}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  iconTrailing="arrow-right"
                  className="cr-next-go"
                  onClick={() => setExIdx(nextEx.i)}
                >
                  {cs.circuitNext === 'Next' ? 'Go' : undefined}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <CircuitExerciseCard
            key={`${cur.id}-${roundIdx}`}
            exercise={cur}
            slot={`${letter}${exIdx + 1}`}
            round={roundIdx + 1}
            goalReps={goalReps}
            seedReps={seedReps}
            seedWeight={seedWeight}
            weighted={weighted}
            last={exIdx === n - 1}
            onMuscle={props.onMuscle}
            onLog={(vals) => {
              props.onLog(cur, vals);
              advance(exIdx);
            }}
          />
        )}
      </div>

      <div className="cr-foot">
        <Button variant="primary" className="cr-complete" onClick={completeRound}>
          <Icon name="check-circle" />
          {cs.circuitCompleteRound}
        </Button>
        <Button variant="secondary" className="cr-finish" onClick={props.onClose}>
          {cs.circuitFinishAll}
        </Button>
      </div>
    </Sheet>
  );
}

function CircuitExerciseCard(props: {
  exercise: Exercise;
  slot: string;
  round: number;
  goalReps: number;
  seedReps: number;
  seedWeight: number | null;
  weighted: boolean;
  last: boolean;
  onMuscle: (m: MuscleGroup) => void;
  onLog: (vals: Omit<SetEntry, 'id' | 'position'>) => void;
}) {
  const { t, locale } = useT();
  const cs = STRINGS[locale];
  const [reps, setReps] = useState(props.seedReps);
  const [weight, setWeight] = useState<number>(props.seedWeight ?? 0);

  function log() {
    props.onLog({
      reps,
      weight: props.weighted ? weight : null,
      isWarmup: false,
      type: 'working',
      drops: [],
      durationMin: null,
      distanceKm: null,
      calories: null,
      rpe: null,
    });
  }

  return (
    <div className="cr-card">
      <div className="cr-card-head">
        <span className="slot">{props.slot}</span>
        <span className="cr-card-name">{props.exercise.name}</span>
      </div>
      <div className="cr-mus">
        {circuitMuscleChips(props.exercise, props.onMuscle, { icon: true })}
      </div>
      <div className="cr-goal">
        <Icon name="target" />
        <span>
          {cs.circuitRoundGoal} ·{' '}
          <strong>
            {props.goalReps} {t.chUnit.reps}
          </strong>
        </span>
      </div>
      <div className="cr-steppers">
        <div className="cr-step">
          <div className="lbl">{t.repsCol}</div>
          <div className="cr-step-ctl">
            <IconButton
              icon="minus"
              size="sm"
              label="-"
              onClick={() => setReps(Math.max(0, reps - 1))}
            />
            <span className="num">{reps}</span>
            <IconButton icon="plus" size="sm" label="+" onClick={() => setReps(reps + 1)} />
          </div>
        </div>
        {props.weighted && (
          <div className="cr-step">
            <div className="lbl">{t.kgCol}</div>
            <div className="cr-step-ctl">
              <IconButton
                icon="minus"
                size="sm"
                label="-"
                onClick={() => setWeight(Math.max(0, weight - 2.5))}
              />
              <span className="num">{fmtWeightValue(weight)}</span>
              <IconButton icon="plus" size="sm" label="+" onClick={() => setWeight(weight + 2.5)} />
            </div>
          </div>
        )}
      </div>
      <Button variant="primary" className="cr-log" onClick={log}>
        <Icon name="check" />
        {cs.circuitLogRound(props.slot, props.round)}
      </Button>
      {props.weighted ? (
        <div className="cr-swipe">
          <Icon name="arrow-left" />
          {cs.circuitSwipeHint}
          <Icon name="arrow-right" />
        </div>
      ) : (
        <div className="cr-noload">{cs.circuitNoLoad}</div>
      )}
    </div>
  );
}
