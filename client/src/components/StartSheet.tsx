/**
 * Start sheet — the single entry point behind the notched "+" in the tab bar
 * (design "Spotter — Start Sheet", variant A). One big context hero on top — the
 * program day, your usual weekday play, or a session from scratch (or Resume
 * while something is live) — and four tiles below: Auto session, Activity,
 * Health (sleep, rest, illness, injury — the full Health page) and Log past.
 * The backfill sub-sheet lives here too so Today can reuse it.
 */
import { illnessState } from '../illness';
import { Notice } from './ui/Notice';
import { Chip } from '../components/ui/Chip';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { ListRow } from './ui/GroupedList';
import { Segmented } from './ui/Segmented';
import { Card } from './ui/Card';
import { Ring } from './ui/Ring';
import { IconTile } from './ui/IconTile';
import type { Shell } from '../App';
import type { Gym } from '../types';
import type { Tone } from './ui/tones';
import { HOME_BACKFILL_MIN, type HomeSet } from '../homeSets';
import { currentUid } from '../api';
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
  programDayHasPlan,
  programDayItems,
  programDayName,
  startPlaySession,
  startProgramDaySession,
  useProgramMine,
} from '../data/programMine';
import { fmtDayMonth, fmtDurationHM, fmtKg, fmtWeekday, useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import './HomeSet.css';
import { useLiveLock } from '../views/home/homeHooks';
import { DateField, TimeField, DurationField } from './PickerFields';
import { GymPicker } from './GymPicker';
import { GymThumb } from './GymThumb';

type Sub = null | 'gym' | 'past';

export function StartSheet({
  shell,
  onClose: closeProp,
  inline = false,
}: {
  shell: Shell;
  onClose: () => void;
  /** Desktop Today: the same content as a standing side panel, not a sheet —
   *  its sub-flows (gym, activity, home set, health, log past) still open as
   *  sheets over the page. */
  inline?: boolean;
}) {
  const { t, locale } = useT();
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
  const plays = useMemo(() => computePlaybook(finished, now).plays, [finished, now]);

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
  function done(workoutId: string | null) {
    onClose();
    if (workoutId) shell.openOverlay({ screen: 'session', workoutId });
  }
  /** Where the picked gym leads: a blank session, or the hero's prefilled one. */
  const [gymFor, setGymFor] = useState<'scratch' | 'hero'>('scratch');
  function beginScratch(gymId: string | null) {
    const w = startWorkout(gymId);
    done(w ? w.id : null);
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
  async function startHero() {
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
      ? [...new Set(program!.program.items.map((i) => i.day))].sort((a, b) => a - b)
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
        onPick={gymFor === 'hero' ? beginHero : beginScratch}
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
    <StartFrame inline={inline} onClose={closeProp} sub={subEl} tone={doneToday ? 'ok' : undefined}>
      <div className="ss-title">{t.startSheetTitle}</div>
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
        <Card
          as="button"
          className={`ss-tile${locked ? ' locked' : ''}`}
          aria-disabled={locked}
          onClick={locked ? undefined : autoBuild}
        >
          <span className="ss-tile-top">
            <IconTile tone="accent" size={40} icon="robot" className="ss-ic" />
            {locked && <Icon name="lock-simple" className="ss-lock" />}
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startAutoTitle}</span>
            <span className="ss-ts">{locked ? t.startFinishFirst(liveName) : t.startAutoSub}</span>
          </span>
        </Card>
        <Card
          as="button"
          className={`ss-tile${locked ? ' locked' : ''}`}
          aria-disabled={locked}
          onClick={locked ? undefined : openActivity}
        >
          <span className="ss-tile-top">
            <IconTile tone="conditioning" size={40} icon="heartbeat" className="ss-ic" />
            {locked && <Icon name="lock-simple" className="ss-lock" />}
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startActivityTitle}</span>
            <span className="ss-ts">
              {locked ? t.startFinishFirst(liveName) : t.startActivitySub}
            </span>
          </span>
        </Card>
        <Card as="button" className="ss-tile" onClick={openHealth}>
          <IconTile tone="rest" size={40} icon="clock-countdown" className="ss-ic" />
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startHealthTitle}</span>
            <span className="ss-ts">{t.startHealthSub}</span>
          </span>
        </Card>
        <Card as="button" className="ss-tile" onClick={() => setSub('past')}>
          <IconTile tone="neutral" size={40} icon="arrow-counter-clockwise" className="ss-ic" />
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startPastTitle}</span>
            <span className="ss-ts">{t.startPastSub}</span>
          </span>
        </Card>
        <Card as="button" className="ss-tile" onClick={openPrograms}>
          <IconTile tone="accent" size={40} icon="list-checks" className="ss-ic" />
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startProgramsTitle}</span>
            <span className="ss-ts">{t.startProgramsSub}</span>
          </span>
        </Card>
        <Card
          as="button"
          className={`ss-tile${locked ? ' locked' : ''}`}
          aria-disabled={locked}
          onClick={locked ? undefined : openHome}
        >
          <span className="ss-tile-top">
            <IconTile tone="home" size={40} icon="house" className="ss-ic" />
            {locked && <Icon name="lock-simple" className="ss-lock" />}
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startHomeTitle}</span>
            <span className="ss-ts">{locked ? t.startFinishFirst(liveName) : t.startHomeSub}</span>
          </span>
        </Card>
      </div>
    </StartFrame>
  );
}

/** The Start content as a sheet (mobile) or a standing side panel (desktop). */
function StartFrame(props: {
  inline: boolean;
  tone?: Tone;
  onClose: () => void;
  sub: ReactNode;
  children: ReactNode;
}) {
  if (!props.inline)
    return (
      <Sheet onClose={props.onClose} className="start-sheet" tone={props.tone}>
        {props.children}
      </Sheet>
    );
  return (
    <>
      <div className="start-inline">{props.children}</div>
      {props.sub}
    </>
  );
}

/** Backfill a past session — spec docs/specs/backfill-session.md (AC-1…AC-3). */
export function BackfillSheet(props: {
  gyms: Gym[];
  onClose: () => void;
  onCreate: (startedAt: number, durationMs: number, gymId: string | null) => void;
  /** Log past → Home set: a finished home set prefilled with the chosen set. */
  onCreateHome?: (startedAt: number, durationMs: number, set: HomeSet | null) => void;
  /** Prefill the date (YYYY-MM-DD) — e.g. "Log for Sep 29" on the History calendar. */
  initialDate?: string;
}) {
  const { t } = useT();
  const homeSets = useStore().home.sets;
  const [kind, setKind] = useState<'gym' | 'home'>('gym');
  const [homeSetId, setHomeSetId] = useState<string | null>(homeSets[0]?.id ?? null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymPicker, setGymPicker] = useState(false);
  const chosenGym = props.gyms.find((g) => g.id === gymId) ?? null;
  const [defaults] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
  });
  const [date, setDate] = useState(props.initialDate ?? defaults.date);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [now] = useState(() => Date.now());

  const [todayIso] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

  const startedAt = new Date(`${date}T${time}`).getTime();
  const inFuture = !Number.isNaN(startedAt) && startedAt > now;
  const badDuration = duration < 1 || duration > 480;
  const invalid = Number.isNaN(startedAt) || inFuture || badDuration;

  return (
    <Sheet onClose={props.onClose} className="backfill-sheet">
      <div className="sheet-head backfill-head">
        <Icon name="arrow-counter-clockwise" />
        <span className="t">{t.logPastSession}</span>
      </div>
      {props.onCreateHome && (
        <Segmented
          tabs
          className="backfill-kind"
          options={[
            { value: 'gym', label: t.backfillKindGym },
            { value: 'home', label: t.backfillKindHome },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (k === 'gym' && duration === HOME_BACKFILL_MIN) setDuration(60);
            if (k === 'home' && duration === 60) setDuration(HOME_BACKFILL_MIN);
          }}
        />
      )}
      {kind === 'home' && (
        <div className="field-block">
          <span className="field-label">{t.backfillWhichHomeSet}</span>
          <div className="backfill-sets">
            {homeSets.map((hs) => (
              <Chip selected={homeSetId === hs.id} key={hs.id} onClick={() => setHomeSetId(hs.id)}>
                {hs.name}
              </Chip>
            ))}
            <Chip selected={homeSetId === null} onClick={() => setHomeSetId(null)}>
              {t.backfillHomeEmpty}
            </Chip>
          </div>
        </div>
      )}
      <div className="backfill-fields">
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
      </div>
      {kind === 'home' && <div className="hs-hint">{t.backfillHomeNote}</div>}
      {kind === 'gym' && props.gyms.length > 0 && (
        <label className="field-block">
          <span className="field-label">{t.backfillGym}</span>
          <ListRow
            onClick={() => setGymPicker((x) => !x)}
            icon={
              chosenGym ? (
                <GymThumb
                  name={chosenGym.name}
                  lat={chosenGym.lat}
                  lng={chosenGym.lng}
                  size={28}
                  boxed
                />
              ) : undefined
            }
            label={chosenGym ? chosenGym.name : t.backfillGymChoose}
            trailing={<Icon name={gymPicker ? 'caret-left' : 'arrow-right'} className="go" />}
          />
          {gymPicker && (
            <GymPicker
              gyms={props.gyms}
              title={t.pickGymTitle}
              variant="inline"
              onClose={() => setGymPicker(false)}
              onPick={(id) => {
                setGymId(id);
                setGymPicker(false);
              }}
            />
          )}
        </label>
      )}
      {inFuture && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {t.backfillFuture}
        </div>
      )}
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={invalid}
          onClick={() =>
            kind === 'home' && props.onCreateHome
              ? props.onCreateHome(
                  startedAt,
                  duration * 60000,
                  homeSets.find((x) => x.id === homeSetId) ?? null,
                )
              : props.onCreate(startedAt, duration * 60000, gymId)
          }
        >
          {t.backfillContinue}
        </Button>
      </div>
    </Sheet>
  );
}
