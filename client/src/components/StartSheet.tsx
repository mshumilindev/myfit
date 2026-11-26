/**
 * Start sheet — the single entry point behind the notched "+" in the tab bar
 * (design "Spotter — Start Sheet", variant A). One big context hero on top — the
 * program day, your usual weekday play, or a session from scratch (or Resume
 * while something is live) — and four tiles below: Auto session, Activity,
 * Health (sleep, rest, illness, injury — the full Health page) and Log past.
 * The backfill sub-sheet lives here too so Today can reuse it.
 */
import { usePlaybookOn } from '../addons/featureGates';
import { useActivitiesOn } from '../addons/activitiesGate';
import { illnessState } from '../illness';
import { Notice } from './ui/Notice';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Ring } from './ui/Ring';
import { IconTile } from './ui/IconTile';
import type { Shell } from '../App';
import { currentUid } from '../api';
import { useAddonOrBase } from '../addons/enabledSet';
import { useTimeBlocksOn } from '../addons/featureGates';
import {
  activeRestPeriod,
  backfillHomeSet,
  backfillWorkout,
  dayKey,
  gymAtCurrentPosition,
  programDayNameFor,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
  startWorkout,
  useStore,
} from '../store';
import { computePlaybook, playForWeekday } from '../playbook';
import { dayReadoutLabel } from '../data/daySuggest';
import {
  assignmentWeek,
  programDayHasPlan,
  programDayItems,
  programDayName,
  startPlaySession,
  startProgramDaySession,
  useProgramMine,
} from '../data/programMine';
import { fmtDayMonth, fmtDurationHM, fmtKg, fmtWeekday, useT } from '../i18n';
import { Icon } from '../ui';
import './HomeSet.css';
import { useLiveLock } from '../views/home/homeHooks';
import { GymPicker } from './GymPicker';
import { BackfillSheet } from './BackfillSheet';
import { StartFrame } from './StartFrame';
import { StartTile } from './StartTile';
import './StartSheetBento.css';

type Sub = null | 'gym' | 'past';

export function StartSheet({
  shell,
  onClose: closeProp,
  inline = false,
  closeRequested = false,
}: {
  shell: Shell;
  onClose: () => void;
  /** Closed from outside (the Start button's ×): the drawer slides out like on a swipe, then calls `onClose`. */
  closeRequested?: boolean;
  /** Desktop Today: the same content as a standing side panel, not a sheet —
   *  its sub-flows (gym, activity, home set, health, log past) still open as
   *  sheets over the page. */
  inline?: boolean;
}) {
  const { t, locale } = useT();
  // Health is an add-on (SPO-518): its tile is offered only while it is installed.
  const healthOn = useAddonOrBase('health');
  const sleepOn = useAddonOrBase('sleep');
  const activitiesOn = useActivitiesOn();
  const homeOn = useAddonOrBase('home-sets');
  const blocksOn = useTimeBlocksOn();
  const store = useStore();
  const { assignment, active: assignedActive } = useProgramMine();
  const [sub, setSub] = useState<Sub>(null);
  // Inline, "closing" only closes the sub-flow; the panel itself stays.
  const onClose = inline ? () => setSub(null) : closeProp;
  const [now] = useState(() => Date.now());

  // One live thing at a time: while a session (with an exercise), an activity
  // or a sleep runs, the other starters are locked — only Resume, Health and
  // Log past (it doesn't start anything) stay open.
  const { open, liveAct, sleepLive, busy, locked, liveName } = useLiveLock();
  const activeRest = activeRestPeriod(now);
  const illSt = illnessState(store.restPeriods, store.workouts, now);

  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );
  const playbookOn = usePlaybookOn();
  const plays = useMemo(
    () => (playbookOn ? computePlaybook(finished, now).plays : []),
    [playbookOn, finished, now],
  );

  const todayWeekday = ((new Date(now).getDay() + 6) % 7) + 1;
  const weekdayName = fmtWeekday(now, locale);
  const trainedToday = finished.some((w) => dayKey(w.startedAt) === dayKey(now));
  const program = assignment && assignedActive ? assignment : null;
  const programToday =
    program && !trainedToday && !activeRest && programDayHasPlan(program, todayWeekday)
      ? {
          name: programDayName(program, todayWeekday, t.progDay),
          // Muscles only, no exercises: the hero already starts an empty session.
          empty: programDayItems(program, todayWeekday).length === 0,
        }
      : null;
  // Trained today (and nothing live): the hero reports the day as done, and the
  // next session is an empty one — never "your usual day" again.
  const doneToday = trainedToday && !busy;
  const lastToday = doneToday
    ? (finished
        .filter((w) => dayKey(w.startedAt) === dayKey(now))
        .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null)
    : null;
  const usual = programToday || doneToday ? null : playForWeekday(plays, new Date(now).getDay());

  /** Tap on anything while a session / activity / sleep is live → resume it. */
  function resumeLive(): boolean {
    if (open) {
      shell.openOverlay({ screen: 'session', workoutId: open.id });
      return true;
    }
    if (liveAct) {
      shell.openOverlay({ screen: 'activity' });
      return true;
    }
    if (sleepLive) {
      shell.openOverlay({ screen: 'sleep' });
      return true;
    }
    return false;
  }
  function done(workoutId: string | null, startBlock = false) {
    onClose();
    if (workoutId)
      shell.openOverlay({ screen: 'session', workoutId, ...(startBlock ? { startBlock } : {}) });
  }
  /** Where the picked gym leads: a blank session, or the hero's prefilled one. */
  const [blockStart, setBlockStart] = useState(false);
  const [gymFor, setGymFor] = useState<'scratch' | 'hero'>('scratch');
  function beginScratch(gymId: string | null, block = blockStart) {
    const w = startWorkout(gymId);
    done(w ? w.id : null, block);
  }
  /** The hero's session (program day, else usual weekday play) at `gymId`. */
  function beginHero(gymId: string | null) {
    if (program && programToday) {
      done(startProgramDaySession(program, todayWeekday, programToday.name, gymId));
      return;
    }
    if (usual) {
      done(startPlaySession(usual, t.defaultTimedExerciseNames.warmup, gymId));
      return;
    }
    beginScratch(gymId);
  }
  async function startScratch() {
    setBlockStart(false);
    if (resumeLive()) return onClose();
    // Standing in one of your gyms → no question, just start there. Otherwise
    // ask — the picker also finds gyms nearby that aren't saved yet.
    const here = await gymAtCurrentPosition(store.gyms);
    if (here) beginScratch(here.id);
    else {
      setGymFor('scratch');
      setSub('gym');
    }
  }
  /** Time block tile: a blank session that opens with the block builder. */
  async function startBlock() {
    if (resumeLive()) return onClose();
    setBlockStart(true);
    const here = await gymAtCurrentPosition(store.gyms);
    if (here) beginScratch(here.id, true);
    else {
      setGymFor('scratch');
      setSub('gym');
    }
  }
  async function startHero() {
    setBlockStart(false);
    if (resumeLive()) return onClose();
    if (!(program && programToday) && !usual) return void startScratch();
    // Same gym step as a blank session: in one of your gyms → start there;
    // anywhere else → pick the gym first (it may be one nearby, not saved yet).
    const here = await gymAtCurrentPosition(store.gyms);
    if (here) beginHero(here.id);
    else {
      setGymFor('hero');
      setSub('gym');
    }
  }
  function autoBuild() {
    if (resumeLive()) return onClose();
    const own = !!program && program.program.authorId === currentUid();
    const programMode: 'none' | 'own' | 'other' = !program ? 'none' : own ? 'own' : 'other';
    const programDays = own
      ? [...new Set(assignmentWeek(program!).items.map((i) => i.day))].sort((a, b) => a - b)
      : [];
    onClose();
    shell.openOverlay({ screen: 'builder', programMode, programDays });
  }
  function openActivity() {
    // The Log activity page (design docs/design/log-activity) replaced the picker
    // drawer. It stays open while something is live: the page has its own live
    // state (m07 — resume banner, starting locked, past logs still allowed).
    onClose();
    shell.openOverlay({ screen: 'log-activity' });
  }
  function openHome() {
    // The Home set screen (sets, my moves, the set page) is a full overlay.
    onClose();
    shell.openOverlay({ screen: 'home-set' });
  }
  function openPrograms() {
    // Programs is a tab, not an overlay; nothing starts, so it stays open while something is live.
    onClose();
    shell.goTab('programs');
  }
  function openSleep() {
    onClose();
    shell.openOverlay({ screen: 'sleep' });
  }
  function openHealth() {
    // The full Health page (design docs/design/health) replaced the old
    // "Rest & recovery" drawer.
    onClose();
    shell.openOverlay({ screen: 'health' });
  }

  let subEl: ReactNode = null;
  if (sub === 'gym')
    subEl = (
      <GymPicker
        gyms={store.gyms}
        title={t.pickGymTitle}
        onClose={onClose}
        onPick={gymFor === 'hero' ? beginHero : (id) => beginScratch(id)}
      />
    );
  else if (sub === 'past')
    subEl = (
      <BackfillSheet
        gyms={store.gyms}
        onClose={onClose}
        onCreate={(startedAt, durationMs, gymId) => {
          const w = backfillWorkout(startedAt, durationMs, gymId);
          onClose();
          shell.openOverlay({ screen: 'past-workout', workoutId: w.id, startAdd: true });
        }}
        onCreateHome={(startedAt, durationMs, set) => {
          const w = backfillHomeSet(startedAt, durationMs, set);
          onClose();
          shell.openOverlay({ screen: 'past-workout', workoutId: w.id, startAdd: !set });
        }}
      />
    );

  if (subEl && !inline) return subEl;

  const hero = busy
    ? { kicker: t.startInProgress, title: liveName, sub: t.startResume, icon: 'arrow-right' }
    : programToday && program
      ? {
          kicker: t.startTodayInProgram,
          title: programToday.name,
          sub: `${program.program.name} · ${weekdayName}`,
          icon: 'play',
        }
      : usual
        ? {
            kicker: t.startUsualDay(weekdayName),
            title:
              usual.name ?? (usual.readout ? dayReadoutLabel(usual.readout, t) : t.playUntitled),
            sub: t.startFromPlaybook(fmtDayMonth(usual.lastTrainedAt, locale)),
            icon: 'play',
          }
        : {
            kicker: t.startASession,
            title: t.sbFromScratch,
            sub: t.startScratchSub,
            icon: 'play',
          };
  // "Or start from scratch" only when the hero would start something prefilled.
  const offerScratch = !busy && (programToday ? !programToday.empty : !!usual);

  return (
    <StartFrame
      inline={inline}
      onClose={closeProp}
      closeRequested={closeRequested}
      sub={subEl}
      tone={doneToday ? 'ok' : undefined}
      label={t.startSheetTitle}
    >
      {inline ? <div className="ss-title">{t.startSheetTitle}</div> : null}
      {illSt.phase === 'sick' || illSt.phase === 'returning' || illSt.phase === 'mental' ? (
        <Notice tone="illness" icon="thermometer-simple">
          {illSt.phase === 'mental'
            ? t.illStartWarnMental
            : t.illStartWarn(Math.round(illSt.caps.volume * 100))}
        </Notice>
      ) : null}
      {lastToday ? (
        <>
          <Card
            as="button"
            emphasis="hero"
            tone="ok"
            className="ss-hero"
            onClick={() => {
              onClose();
              shell.openOverlay({ screen: 'past-workout', workoutId: lastToday.id });
            }}
          >
            <span className="ss-hero-text">
              <span className="ss-hero-kicker">{t.startDoneKicker}</span>
              <span className="ss-hero-title">
                {programDayNameFor(lastToday, finished) ??
                  (workoutDayReadout(lastToday)
                    ? dayReadoutLabel(workoutDayReadout(lastToday)!, t)
                    : fmtWeekday(lastToday.startedAt, locale))}
              </span>
              <span className="ss-hero-sub">
                {`${fmtDurationHM((lastToday.finishedAt ?? lastToday.startedAt) - lastToday.startedAt)} · ${workoutSets(lastToday)} ${t.sets} · ${fmtKg(workoutVolumeKg(lastToday))}`}
              </span>
            </span>
            <Ring value={100} size={60} width={4} tone="ok">
              <Icon name="check" />
            </Ring>
          </Card>
          <Card
            as="button"
            tone="accent"
            className="ss-another"
            onClick={() => void startScratch()}
          >
            <IconTile tone="accent" size={40} icon="plus" />
            <span className="ss-tile-text">
              <span className="ss-tt">{t.startAnotherTitle}</span>
              <span className="ss-ts">{t.startScratchSub}</span>
            </span>
            <Icon name="caret-right" />
          </Card>
        </>
      ) : (
        <Card as="button" emphasis="hero" className="ss-hero" onClick={() => void startHero()}>
          <span className="ss-hero-text">
            <span className="ss-hero-kicker">{hero.kicker}</span>
            <span className="ss-hero-title">{hero.title}</span>
            <span className="ss-hero-sub">{hero.sub}</span>
          </span>
          <span className="ss-hero-go" aria-hidden>
            <Icon name={hero.icon} weight="fill" />
          </span>
        </Card>
      )}
      {offerScratch && (
        <Button
          variant="link"
          className="ss-scratch"
          icon="plus"
          onClick={() => void startScratch()}
        >
          {t.startOrScratch}
        </Button>
      )}
      <div className="ss-grid">
        <StartTile
          lockable
          locked={locked}
          tone="accent"
          icon="robot"
          title={t.startAutoTitle}
          sub={t.startAutoSub}
          lockedSub={t.startFinishFirst(liveName)}
          onClick={autoBuild}
        />
        {blocksOn && (
          <StartTile
            lockable
            locked={locked}
            tone="conditioning"
            icon="timer"
            title={t.startBlockTitle}
            sub={t.startBlockSub}
            lockedSub={t.startFinishFirst(liveName)}
            onClick={() => void startBlock()}
          />
        )}
        {activitiesOn && (
          <StartTile
            lockable
            locked={locked}
            tone="conditioning"
            icon="heartbeat"
            title={t.startActivityTitle}
            sub={t.startActivitySub}
            lockedSub={t.startFinishFirst(liveName)}
            onClick={openActivity}
          />
        )}
        {healthOn && (
          <StartTile
            tone="rest"
            icon="clock-countdown"
            title={t.startHealthTitle}
            sub={t.startHealthSub}
            onClick={openHealth}
          />
        )}
        {sleepOn && (
          <StartTile
            tone="sleep"
            icon="moon"
            title={t.sleepTitle}
            sub={t.startSleepSub}
            onClick={openSleep}
          />
        )}
        <StartTile
          tone="neutral"
          icon="arrow-counter-clockwise"
          title={t.startPastTitle}
          sub={t.startPastSub}
          onClick={() => setSub('past')}
        />
        <StartTile
          tone="accent"
          icon="list-checks"
          title={t.startProgramsTitle}
          sub={t.startProgramsSub}
          onClick={openPrograms}
        />
        {homeOn && (
          <StartTile
            lockable
            locked={locked}
            tone="home"
            icon="house"
            title={t.startHomeTitle}
            sub={t.startHomeSub}
            lockedSub={t.startFinishFirst(liveName)}
            onClick={openHome}
          />
        )}
      </div>
    </StartFrame>
  );
}

export { BackfillSheet };
