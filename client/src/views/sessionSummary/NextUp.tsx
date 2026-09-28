/**
 * "Next up" on the Session summary (design docs/design/log-activity/BRIEF3.md,
 * artboards p01–p05): when history shows the athlete usually does something
 * right after lifting, the summary offers to start it at once.
 *
 *   • p01 — the card right after the headline / Atlas debrief: icon in its
 *     colour family, "Sauna · 20 min", the reason, an evidence strip, Start
 *     (live timer) / Log N min (logged from the workout's finish), up to two
 *     alternative chips (tap = start that one) and the ⋯ options.
 *   • p02 — after Start: a sticky live banner (elapsed, Pause/Finish) on top of
 *     the summary, the card folded into a compact "running" row; Done still
 *     closes the summary while the timer keeps going.
 *   • p03 — options sheet: Not today, Change to… (Log activity page), Don't
 *     suggest <X> after workouts (synced `nextUpOff`, snackbar with Undo).
 *   • p04 — no pattern: a quiet "Anything after this? Log activity ›" row.
 *   • p05 — web (≥720px): the same pieces in a right-hand panel with Today.
 *
 * `useNextUp` holds the state (called once by SessionView, above its early
 * return); the small components below render the pieces where the summary
 * layout puts them. What to suggest is decided by the pure `nextUp.ts`.
 */
import { useMemo, useState } from 'react';
import type { Shell } from '../../App';
import {
  deleteActivity,
  discardActivity,
  finishActivity,
  latestWeight,
  liveSleep,
  logActivity,
  pauseActivity,
  resumeActivity,
  startActivity,
  useStore,
} from '../../store';
import {
  activityElapsedMs,
  activityTone,
  activityType,
  durationMin,
  estimateCalories,
  isActivityPaused,
} from '../../activities';
import {
  NEXT_UP_FOLLOW_MS,
  nextUpLookbackCount,
  nextUpStrip,
  nextUpSuggestions,
  type NextUp,
  type NextUpInput,
} from '../../nextUp';
import { nextUpOff, setNextUpOff, useNextUpOff } from '../../activityPrefs';
import { useT } from '../../i18n';
import type { Strings } from '../../i18n/en';
import { Icon, Sheet } from '../../ui';
import type { Activity, Workout } from '../../types';
import { clock, fmtApprox, hhmm, nowMs, typeIcon, typeName, useNow } from '../logActivity/shared';
import './NextUp.css';

const MIN = 60_000;

// --- summary-scoped memory (survives the Log activity round trip) ---------------------

/** Workouts whose suggestion the athlete dismissed with "Not today". */
const hiddenFor = new Set<string>();
/** Live activity id → the suggested minutes it was started with (p02 "of ~20 min"). */
const plannedFor = new Map<string, number>();
/** The summary to reopen when the session screen comes back from a drill-in. */
let summaryReturn: { id: string; at: number } | null = null;
const RETURN_TTL = 30 * MIN;

/** Opening another screen FROM the summary: come back to the summary, not the editor. */
export function markSummaryReturn(workoutId: string): void {
  summaryReturn = { id: workoutId, at: Date.now() };
}
/** Whether the session screen should open straight on its summary. */
export function summaryReturnFor(workoutId: string): boolean {
  return (
    !!summaryReturn && summaryReturn.id === workoutId && Date.now() - summaryReturn.at < RETURN_TTL
  );
}
export function clearSummaryReturn(): void {
  summaryReturn = null;
}
/** Tests: forget "Not today" and the return marker. */
export function __resetNextUpForTests(): void {
  hiddenFor.clear();
  plannedFor.clear();
  summaryReturn = null;
}

// --- model ----------------------------------------------------------------------------

type Tone = 'nu-g' | 'nu-s' | 'nu-r';

function toneOf(key: string): Tone {
  const at = activityType(key);
  const tone = activityTone(key, at?.category ?? 'conditioning');
  return tone === 'sport' ? 'nu-s' : tone === 'recovery' ? 'nu-r' : 'nu-g';
}

export interface NextUpModel {
  workout: Workout;
  /** The live activity started after this workout (p02), if any. */
  live: Activity | null;
  /** Latest finished activity logged right after this workout (the compact "logged" row). */
  logged: Activity | null;
  /** Something else is live (another activity / a sleep / a workout) → Start is off. */
  startBlocked: boolean;
  top: NextUp | null;
  alternatives: NextUp[];
  lookback: number;
  input: NextUpInput;
  now: number;
  optionsOpen: boolean;
  setOptionsOpen: (v: boolean) => void;
  start: (s: NextUp) => void;
  log: (s: NextUp) => void;
  notToday: () => void;
  changeTo: () => void;
  dontSuggest: (s: NextUp) => void;
  openLogActivity: () => void;
  pause: () => void;
  finish: () => void;
  cancelLive: () => void;
  undoLogged: () => void;
}

export function useNextUp(
  workout: Workout | undefined,
  active: boolean,
  shell: Shell,
): NextUpModel | null {
  const { t } = useT();
  const store = useStore();
  const off = useNextUpOff();
  const [, setTick] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const liveAny = store.activities.find((a) => a.finishedAt === null) ?? null;
  const now = useNow(active && !!liveAny);
  const end = workout?.finishedAt ?? null;
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;

  const input = useMemo<NextUpInput | null>(
    () =>
      workout && end !== null
        ? {
            workouts: store.workouts,
            activities: store.activities,
            finishedWorkoutId: workout.id,
            now: end,
            off,
          }
        : null,
    [workout, end, store.workouts, store.activities, off],
  );
  const result = useMemo(() => (input ? nextUpSuggestions(input) : null), [input]);
  const lookback = useMemo(() => (input ? nextUpLookbackCount(input) : 0), [input]);

  if (!workout || end === null || !input || !result || !active) return null;

  const live = liveAny && liveAny.startedAt >= end ? liveAny : null;
  const logged =
    store.activities
      .filter(
        (a) =>
          a.finishedAt !== null && a.startedAt >= end && a.startedAt - end <= NEXT_UP_FOLLOW_MS,
      )
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
  const openWorkout = store.workouts.some((w) => w.finishedAt === null);
  const startBlocked = (!!liveAny && !live) || !!liveSleep(store.sleeps) || openWorkout;
  const hidden = hiddenFor.has(workout.id);

  function lastEffort(key: string) {
    return (
      store.activities.find((a) => a.type === key && a.finishedAt !== null)?.effort ?? 'moderate'
    );
  }
  function snackLogged(a: Activity): void {
    const name = typeName(a.type, t);
    shell.snack({
      text: t.laLoggedToast(name, fmtApprox(durationMin(a), t)),
      onUndo: () => deleteActivity(a.id),
    });
  }

  return {
    workout,
    live,
    logged,
    startBlocked,
    top: hidden ? null : result.top,
    alternatives: hidden ? [] : result.alternatives,
    lookback,
    input,
    now,
    optionsOpen,
    setOptionsOpen,
    start(s) {
      const type = activityType(s.type);
      if (!type || startBlocked || live) return;
      const a = startActivity(type.key, type.category);
      if (a) plannedFor.set(a.id, s.minutes);
    },
    log(s) {
      const type = activityType(s.type);
      if (!type) return;
      const effort = lastEffort(s.type);
      const a = logActivity({
        type: type.key,
        category: type.category,
        startedAt: end,
        finishedAt: end + s.minutes * MIN,
        durationMin: s.minutes,
        calories: estimateCalories(type, s.minutes, bodyKg, effort),
        effort,
      });
      snackLogged(a);
    },
    notToday() {
      hiddenFor.add(workout.id);
      setOptionsOpen(false);
      setTick((n) => n + 1);
    },
    changeTo() {
      setOptionsOpen(false);
      markSummaryReturn(workout.id);
      shell.openOverlay({ screen: 'log-activity' });
    },
    dontSuggest(s) {
      setOptionsOpen(false);
      if (!nextUpOff().includes(s.type)) setNextUpOff([...nextUpOff(), s.type]);
      shell.snack({
        text: t.nuOffToast(typeName(s.type, t)),
        onUndo: () => setNextUpOff(nextUpOff().filter((k) => k !== s.type)),
      });
    },
    openLogActivity() {
      markSummaryReturn(workout.id);
      shell.openOverlay({ screen: 'log-activity' });
    },
    pause() {
      if (!live) return;
      if (isActivityPaused(live)) resumeActivity(live.id);
      else pauseActivity(live.id);
    },
    finish() {
      if (!live) return;
      const type = activityType(live.type);
      const mins = activityElapsedMs(live, nowMs()) / MIN;
      const kcal = type ? estimateCalories(type, mins, bodyKg, live.effort ?? 'moderate') : null;
      finishActivity(live.id, { calories: kcal });
    },
    cancelLive() {
      if (live) discardActivity(live.id);
    },
    undoLogged() {
      if (logged) deleteActivity(logged.id);
    },
  };
}

// --- pieces ---------------------------------------------------------------------------

function catLabel(key: string, t: Strings): string {
  const at = activityType(key);
  if (at?.sport) return t.actSports;
  return at?.category === 'recovery' ? t.actRecovery : t.actConditioning;
}
function isRecovery(key: string): boolean {
  return activityType(key)?.category === 'recovery';
}

/** p02 — the sticky live banner (blue for recovery, per the colour families). */
export function NextUpLiveBanner({ m }: { m: NextUpModel }) {
  const { t } = useT();
  const live = m.live;
  if (!live) return null;
  const name = typeName(live.type, t);
  const elapsed = activityElapsedMs(live, m.now);
  const paused = isActivityPaused(live);
  const planned = plannedFor.get(live.id) ?? null;
  const pct = planned ? Math.min(100, Math.round((elapsed / (planned * MIN)) * 100)) : 0;
  return (
    <section className={`nu-live ${toneOf(live.type)}`} aria-labelledby="nu-lv-t">
      <div className="nu-row">
        <span className="nu-ico n44">
          <Icon name={typeIcon(live.type)} />
        </span>
        <div className="nu-grow">
          <p className="nu-live-k">
            <span className="nu-dot" aria-hidden="true" />
            {t.nuLiveSince(catLabel(live.type, t), hhmm(live.startedAt))}
          </p>
          <h2 id="nu-lv-t" className="nu-live-t">
            {name} · <span>{clock(elapsed)}</span>
            {planned ? <em> {t.nuOfApprox(fmtApprox(planned, t))}</em> : null}
            {paused ? <em> · {t.laPausedLower}</em> : null}
          </h2>
        </div>
      </div>
      {planned ? (
        <div
          className="nu-prog"
          role="progressbar"
          aria-label={t.nuProgressAria(name)}
          aria-valuemin={0}
          aria-valuemax={planned * 60}
          aria-valuenow={Math.round(elapsed / 1000)}
        >
          <div style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="nu-grid2" style={{ marginTop: 10 }}>
        <button type="button" className="nu-ob on h44" onClick={m.pause}>
          <Icon name={paused ? 'play' : 'pause'} weight="fill" />
          {paused ? t.actResume : t.actPause}
        </button>
        <button type="button" className="nu-ob tone h44" onClick={m.finish}>
          <Icon name="stop" weight="fill" />
          {t.actFinish}
        </button>
      </div>
    </section>
  );
}

/** p01 / p02 / logged — the card slot right after the Atlas debrief. */
export function NextUpCard({ m, web = false }: { m: NextUpModel; web?: boolean }) {
  const { t } = useT();
  if (m.live) {
    const name = typeName(m.live.type, t);
    return (
      <section className={`nu-card nu-compact ${toneOf(m.live.type)}`} aria-labelledby="nu-run-t">
        <span className="nu-ico n36">
          <Icon name={typeIcon(m.live.type)} />
        </span>
        <div className="nu-grow">
          <h2 id="nu-run-t" className="nu-ct">
            {isRecovery(m.live.type) ? t.nuRunningRec(name) : t.nuRunningLoad(name)}
          </h2>
          <p className="nu-cs">{t.nuRunningSub}</p>
        </div>
        <button
          type="button"
          className="nu-x"
          aria-label={t.nuCancelAria(name)}
          onClick={m.cancelLive}
        >
          <Icon name="x" />
        </button>
      </section>
    );
  }
  if (m.logged) {
    const a = m.logged;
    const name = typeName(a.type, t);
    return (
      <section className={`nu-card nu-compact ${toneOf(a.type)}`} aria-labelledby="nu-done-t">
        <span className="nu-ico n36">
          <Icon name="check" />
        </span>
        <div className="nu-grow">
          <h2 id="nu-done-t" className="nu-ct">
            {t.laLoggedToast(name, fmtApprox(durationMin(a), t))}
          </h2>
          <p className="nu-cs">
            {a.category === 'recovery' ? t.laAddedToRecovery : t.laAddedToLoad}
          </p>
        </div>
        <button
          type="button"
          className="nu-undo"
          aria-label={t.laUndoAria(name)}
          onClick={m.undoLogged}
        >
          {t.undo}
        </button>
      </section>
    );
  }
  const top = m.top;
  if (!top) return null;
  const name = typeName(top.type, t);
  const dur = fmtApprox(top.minutes, t);
  const strip = nextUpStrip(m.input, top);
  const reason =
    top.reason === 'after_day_type' && top.dayType
      ? t.nuReasonDay(top.type, name, top.count, top.of, top.dayType)
      : t.nuReason(top.type, name, top.count, top.of);
  const range =
    strip.minMin > 0
      ? strip.minMin === strip.maxMin
        ? fmtApprox(strip.minMin, t)
        : `${strip.minMin}–${fmtApprox(strip.maxMin, t)}`
      : '';
  const counts = isRecovery(top.type) ? t.nuCountsRecovery : t.nuCountsLoad;
  return (
    <>
      <section className={`nu-card ${toneOf(top.type)}`} aria-labelledby="nu-t">
        <div className="nu-h">
          <p className="nu-k">
            <Icon name="clock" />
            {web ? t.nuKickerWeb : t.nuKicker}
          </p>
          <button
            type="button"
            className="nu-more"
            aria-label={t.nuMoreAria}
            aria-haspopup="dialog"
            onClick={() => m.setOptionsOpen(true)}
          >
            <Icon name="dots-three" weight="bold" />
          </button>
        </div>
        <div className="nu-main">
          <span className="nu-ico n56">
            <Icon name={typeIcon(top.type)} />
          </span>
          <div className="nu-grow">
            <h2 id="nu-t" className="nu-title">
              {name} · {dur}
            </h2>
            <p className="nu-why">{reason}</p>
          </div>
        </div>
        {strip.hits.length > 0 && (
          <div
            className="nu-strip"
            role="img"
            aria-label={t.nuStripAria(name, top.count, strip.hits.length)}
          >
            <div
              className="nu-dots"
              style={{ gridTemplateColumns: `repeat(${strip.hits.length}, minmax(0, 1fr))` }}
            >
              {strip.hits.map((y, i) => (
                <span key={i} className={`nu-dt${y ? ' y' : ''}`} />
              ))}
            </div>
            <div className="nu-strip-f">
              <span>{t.nuSessionsAgo(strip.hits.length)}</span>
              <span>{range && !web ? `${t.nuUsually(range)} · ${counts}` : counts}</span>
            </div>
          </div>
        )}
        <div className="nu-grid2" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="nu-ob tone fill"
            disabled={m.startBlocked}
            onClick={() => m.start(top)}
          >
            <Icon name="play" weight="fill" />
            {t.nuStart(name)}
          </button>
          <button
            type="button"
            className="nu-ob on"
            aria-label={t.nuLogAria(name, dur)}
            onClick={() => m.log(top)}
          >
            {t.laLogDur(dur)}
          </button>
        </div>
        {m.alternatives.length > 0 && (
          <div className="nu-alts">
            <p className="nu-alts-l">{t.nuAlsoAfter}</p>
            <div className="nu-chips">
              {m.alternatives.map((s) => {
                const n = typeName(s.type, t);
                const d = fmtApprox(s.minutes, t);
                return (
                  <button
                    key={s.type}
                    type="button"
                    className={`nu-chip ${toneOf(s.type)}`}
                    aria-label={t.nuChipAria(n, d)}
                    disabled={m.startBlocked}
                    onClick={() => m.start(s)}
                  >
                    <span className="nu-ico n28">
                      <Icon name={typeIcon(s.type)} />
                    </span>
                    {n} <small>{d}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
      {m.optionsOpen && <NextUpOptions m={m} top={top} />}
    </>
  );
}

/** p03 — the options sheet under ⋯. */
function NextUpOptions({ m, top }: { m: NextUpModel; top: NextUp }) {
  const { t } = useT();
  const name = typeName(top.type, t);
  const others = m.alternatives.map((s) => typeName(s.type, t));
  return (
    <Sheet onClose={() => m.setOptionsOpen(false)} className="nu-sheet">
      <div className={`nu-sh ${toneOf(top.type)}`}>
        <span className="nu-ico n40">
          <Icon name={typeIcon(top.type)} />
        </span>
        <div className="nu-grow">
          <h2 className="nu-sh-t">
            {name} · {fmtApprox(top.minutes, t)}
          </h2>
          <p className="nu-sh-s">{t.nuSheetSub}</p>
        </div>
      </div>
      <div className="nu-opts">
        <button type="button" className="nu-opt" onClick={m.notToday}>
          <span className="nu-oi">
            <Icon name="moon" />
          </span>
          <span className="nu-ot">
            {t.nuNotToday}
            <small>{t.nuNotTodaySub}</small>
          </span>
        </button>
        <button type="button" className="nu-opt" onClick={m.changeTo}>
          <span className="nu-oi">
            <Icon name="swap" />
          </span>
          <span className="nu-ot">
            {t.nuChangeTo}
            <small>{t.nuChangeToSub}</small>
          </span>
          <span className="nu-chev">
            <Icon name="caret-right" />
          </span>
        </button>
        <button type="button" className="nu-opt" onClick={() => m.dontSuggest(top)}>
          <span className="nu-oi danger">
            <Icon name="eye-slash" />
          </span>
          <span className="nu-ot">
            {t.nuDontSuggest(name)}
            <small>{others.length ? t.nuDontSuggestSub(others) : t.nuDontSuggestSubNone}</small>
          </span>
        </button>
      </div>
      <p className="nu-note">
        <Icon name="info" />
        <span>{t.nuNote(m.lookback)}</span>
      </p>
    </Sheet>
  );
}

/** p04 — the quiet row under the stats when there's nothing to suggest. */
export function NextUpQuiet({ m }: { m: NextUpModel }) {
  const { t } = useT();
  if (m.top || m.live || m.logged) return null;
  return (
    <div className="nu-quiet">
      <span className="nu-quiet-i">
        <Icon name="plus" />
      </span>
      <span>{t.nuAnything}</span>
      <button type="button" className="nu-quiet-a" onClick={m.openLogActivity}>
        {t.nuLogActivity}
        <Icon name="caret-right" />
      </button>
    </div>
  );
}

/** p05 — the web panel: live banner / card (or the quiet row), then Today. */
export function NextUpPanel({ m }: { m: NextUpModel }) {
  const { t } = useT();
  const store = useStore();
  const end = m.workout.finishedAt as number;
  const day0 = new Date(end);
  day0.setHours(0, 0, 0, 0);
  const from = day0.getTime();
  type Row = { id: string; at: number; icon: string; tone: string; name: string; meta: string };
  const rows: Row[] = [
    ...store.workouts
      .filter(
        (w) => w.finishedAt !== null && w.startedAt >= from && w.startedAt < from + 86_400_000,
      )
      .map((w) => ({
        id: w.id,
        at: w.startedAt,
        icon: 'barbell',
        tone: 'nu-n',
        name: w.dayName || t.laWorkoutLive,
        meta: fmtApprox(Math.round(((w.finishedAt as number) - w.startedAt) / MIN), t),
      })),
    ...store.activities
      .filter(
        (a) => a.finishedAt !== null && a.startedAt >= from && a.startedAt < from + 86_400_000,
      )
      .map((a) => ({
        id: a.id,
        at: a.startedAt,
        icon: typeIcon(a.type),
        tone: toneOf(a.type),
        name: typeName(a.type, t),
        meta: fmtApprox(durationMin(a), t),
      })),
  ].sort((a, b) => b.at - a.at);
  return (
    <aside className="nu-panel" aria-label={t.nuTitle}>
      <div className="nu-panel-h">
        <h2>{t.nuTitle}</h2>
        {m.top && m.lookback > 0 && <span>{t.nuFromLast(m.lookback)}</span>}
      </div>
      <NextUpLiveBanner m={m} />
      <NextUpCard m={m} web />
      <NextUpQuiet m={m} />
      {rows.length > 0 && (
        <div className="nu-today">
          <p className="nu-today-h">{t.today}</p>
          {rows.map((r) => (
            <div key={r.id} className="nu-tl">
              <span className={`nu-ico n32 ${r.tone}`}>
                <Icon name={r.icon} />
              </span>
              <span className="nu-grow">
                <span className="nu-tl-n">{r.name}</span>
                <span className="nu-tl-m">{r.meta}</span>
              </span>
              <span className="nu-tl-t">{hhmm(r.at)}</span>
            </div>
          ))}
        </div>
      )}
      {(m.top || m.live || m.logged) && (
        <button type="button" className="nu-else" onClick={m.openLogActivity}>
          <Icon name="plus" />
          {t.nuLogElse}
        </button>
      )}
    </aside>
  );
}

/** p02 — the hint above the actions while the timer runs. */
export function NextUpKeepsTiming({ m }: { m: NextUpModel }) {
  const { t } = useT();
  if (!m.live) return null;
  return (
    <p className={`nu-keeps ${toneOf(m.live.type)}`}>
      <span className="nu-dot sm" aria-hidden="true" />
      {t.nuKeepsTiming(typeName(m.live.type, t))}
    </p>
  );
}
