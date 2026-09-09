/**
 * Read-only session recap of a coached athlete's workout, for a trainer/admin.
 * The athlete's workouts aren't client-readable (rules), so the full session is
 * fetched via the audited `athleteWorkout` Cloud Function and rendered here the
 * way the athlete sees their own past session — sets, types, rest, drop sets,
 * supersets and circuits — but without any editing affordances.
 */
import { useEffect, useState } from 'react';
import type { Shell } from '../App';
import type { Workout, Exercise, SetEntry, SetType } from '../types';
import { callFn } from '../api';
import {
  sessionBlocks,
  groupRounds,
  type SupersetGroup,
  restBeforeSetInWorkout,
  workoutSets,
  workoutVolumeKg,
  setVolumeKg,
  perHandFactor,
} from '../store';
import { useT, fmtTonnes, fmtKg, fmtDurationHM, fmtDayMonth } from '../i18n';
import type { Strings } from '../i18n/en';
import { Icon } from '../ui';

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function typeOf(s: SetEntry): SetType {
  return s.type ?? (s.isWarmup ? 'warmup' : 'working');
}
function loadCell(t: Strings, weight: number | null): string {
  return weight === null ? t.bodyweightShort : String(weight);
}

function KindLabel({ t, s }: { t: Strings; s: SetEntry }) {
  const ty = typeOf(s);
  if (ty === 'static-dynamic') return <span className="kind">{t.setSDShort}</span>;
  if (ty === 'drop' || ty === 'reverse-drop')
    return (
      <span className="kind tdrop">
        <Icon name={ty === 'drop' ? 'caret-line-down' : 'caret-line-up'} />
        {ty === 'drop' ? t.dropWord : t.reverseWord}
      </span>
    );
  if (ty === 'warmup') return <span className="kind">{t.warmup}</span>;
  return <span className="kind">{t.working}</span>;
}

function SetRows({ ex, w, t, round }: { ex: Exercise; w: Workout; t: Strings; round?: boolean }) {
  const sorted = [...ex.sets].sort((a, b) => a.position - b.position);
  return (
    <>
      {sorted.map((s, i) => {
        const restSec = restBeforeSetInWorkout(w, s);
        const drops = typeOf(s) === 'drop' || typeOf(s) === 'reverse-drop' ? (s.drops ?? []) : [];
        const idx = round ? `R${i + 1}` : `${i + 1}`;
        const row = (
          <div className="set-row">
            <span className="idx">{idx}</span>
            <span className="val">{s.reps}</span>
            <span className="val">{loadCell(t, s.weight)}</span>
            <KindLabel t={t} s={s} />
          </div>
        );
        return (
          <div key={s.id} className="set-line">
            {restSec != null && restSec > 0 && (
              <div className="set-rest">{t.restLabel(mmss(restSec))}</div>
            )}
            <div className="set-main">{row}</div>
            {drops.length > 0 && (
              <>
                <div className="drops">
                  <div className="dbar" />
                  <div className="dlist">
                    {drops.map((d, di) => (
                      <div key={di} className="drop-row">
                        <span>{d.reps}</span>
                        <span>{loadCell(t, d.weight)}</span>
                        <span className="kind">{t.dropN(di + 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="set-foot">
                  <span>
                    {t.dropsFoot(drops.length + 1, s.reps + drops.reduce((a, d) => a + d.reps, 0))}
                  </span>
                  <span>{t.inOneSet(fmtKg(setVolumeKg(s) * perHandFactor(ex)))}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function ExerciseCard({
  ex,
  w,
  t,
  round,
}: {
  ex: Exercise;
  w: Workout;
  t: Strings;
  round?: boolean;
}) {
  return (
    <div className="exercise-card">
      <div className="head">
        <span className="name" style={{ cursor: 'default' }}>
          {ex.name}
        </span>
        {perHandFactor(ex) === 2 && (
          <span className="x2-chip">
            <Icon name="arrows-out-line-horizontal" />
            {t.perHandChip}
          </span>
        )}
      </div>
      <div className="set-grid header">
        <span>#</span>
        <span>{t.repsCol}</span>
        <span>{t.kgCol}</span>
        <span />
      </div>
      <SetRows ex={ex} w={w} t={t} round={round} />
    </div>
  );
}

function CircuitCard({ g, t }: { g: SupersetGroup; t: Strings }) {
  const rounds = groupRounds(g);
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
              <span className="cb-name">{t.circuitTitle(g.letter)}</span>
            </div>
            <div className="cb-meta">
              {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
            </div>
          </div>
        </div>
        <div className="cb-summary">
          {g.exercises.map((e, i) => (
            <div key={e.id} className="cb-srow">
              <div className="cb-sline">
                <span className="cb-slot">
                  {g.letter}
                  {i + 1}
                </span>
                <span className="cb-sname">{e.name}</span>
                <span className="cb-scount num">
                  {t.circuitNRoundsShort(Math.min(e.sets.length, rounds), rounds)}
                </span>
              </div>
              <div className="cb-plates">
                {Array.from({ length: rounds }).map((_, r) => {
                  const st = [...e.sets].sort((a, b) => a.position - b.position)[r];
                  const on = !!st;
                  const val = st
                    ? st.weight != null
                      ? `${st.reps}×${st.weight}`
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

export function TraineeSessionView({
  athleteId,
  workoutId,
  athleteName,
  shell,
  onClose,
}: {
  athleteId: string;
  workoutId: string;
  athleteName?: string;
  shell: Shell;
  onClose: () => void;
}) {
  void shell;
  const { t, locale } = useT();
  const [res, setRes] = useState<
    { forId: string; w: Workout } | { forId: string; msg: string } | null
  >(null);

  useEffect(() => {
    let alive = true;
    callFn<{ workout: Workout }>('athleteWorkout', { id: athleteId, workoutId })
      .then((r) => alive && setRes({ forId: workoutId, w: r.workout }))
      .catch((e: unknown) =>
        alive
          ? setRes({ forId: workoutId, msg: (e as { message?: string }).message ?? String(e) })
          : null,
      );
    return () => {
      alive = false;
    };
  }, [athleteId, workoutId]);

  const current = res && res.forId === workoutId ? res : null;
  const loading = !current;
  const errMsg = current && 'msg' in current ? current.msg : null;
  const w = current && 'w' in current ? current.w : null;
  const durationMs = w && w.finishedAt ? w.finishedAt - w.startedAt : null;

  return (
    <div className="screen" style={{ gap: 'var(--space-5)' }}>
      <div className="hist-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-26">{athleteName ?? t.trLiveViewRecap}</h2>
          {w && (
            <div className="sub">
              {fmtDayMonth(w.startedAt, locale)}
              {' · '}
              {workoutSets(w)} {t.sets} · {fmtTonnes(workoutVolumeKg(w))} · {w.exercises.length}{' '}
              {t.exercises}
              {durationMs != null ? ` · ${fmtDurationHM(durationMs)}` : ''}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="detail-muted">…</div>}
      {errMsg && <div className="detail-muted">{errMsg}</div>}

      {w && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {sessionBlocks(w).map((block) => {
            if (block.kind === 'single')
              return <ExerciseCard key={block.exercise.id} ex={block.exercise} w={w} t={t} />;
            const g = block.group;
            if (g.circuit) return <CircuitCard key={g.groupId} g={g} t={t} />;
            return (
              <div key={g.groupId} className="ss-block">
                <div className="ss-bar" />
                <div className="ss-body">
                  <div className="ss-head">
                    <span className="tag tag-accent">{t.supersetTag(g.letter)}</span>
                    <span className="ss-round">{t.circuitNRounds(groupRounds(g))}</span>
                  </div>
                  {g.exercises.map((e) => (
                    <ExerciseCard key={e.id} ex={e} w={w} t={t} round />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
