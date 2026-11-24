/**
 * Circuit rendering (Circuit chunk): the round-based block of a circuit, its run sheet and the exercise card. Moved out of the
 * session screen so the base carries none of it; the core draws these only through `circuitHost` while Circuit is installed.
 */
import { useState } from 'react';
import { Button, IconButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { Exercise } from '../types';
import type { CircuitBlockProps } from '../circuitApi';
import { exerciseVolumeKg, groupRounds } from '../store';
import { MuscleChip, MUSCLE_IDS } from '../components/Muscle';
import { fmtWeightValue } from '../fmtWeight';
import { type MuscleGroup } from '../data/exercises';
import { fmtTonnes, useT } from '../i18n';
import { useExerciseName, Icon } from '../ui';
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

export function circuitMuscleChips(
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
