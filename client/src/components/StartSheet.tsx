/**
 * Start sheet — the single entry point behind the notched "+" in the tab bar
 * (design "Spotter — Start Sheet", variant A). One big context hero on top — the
 * program day, your usual weekday play, or a session from scratch (or Resume
 * while something is live) — and four tiles below: Auto session, Activity,
 * Health (sleep, rest, illness, injury) and Log past. The sub-sheets it opens
 * (rest/recovery, backfill) live here too so Today can reuse them.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { Shell } from '../App';
import type { Gym } from '../types';
import { HOME_BACKFILL_MIN, type HomeSet } from '../homeSets';
import { currentUid } from '../api';
import {
  activeRestPeriod,
  backfillHomeSet,
  backfillWorkout,
  dayKey,
  gymAtCurrentPosition,
  liveSleep,
  startRestPeriod,
  startHomeSet,
  startWorkout,
  useStore,
} from '../store';
import { computePlaybook, playForWeekday } from '../playbook';
import { dayReadoutLabel } from '../data/daySuggest';
import {
  programDayHasPlan,
  programDayName,
  startPlaySession,
  startProgramDaySession,
  useProgramMine,
} from '../data/programMine';
import { fmtDayMonth, fmtWeekday, useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import { ActivitySheet, SleepPanel } from './ActivitySheet';
import { HomeSetSheet } from './HomeSetSheet';
import './HomeSet.css';
import { DateField, TimeField, DurationField } from './PickerFields';
import { GymPicker } from './GymPicker';
import { GymThumb } from './GymThumb';

type Sub = null | 'gym' | 'activity' | 'health' | 'past' | 'home';

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

  const open = store.workouts.find((w) => w.finishedAt === null) ?? null;
  const liveAct = store.activities.find((a) => a.finishedAt === null) ?? null;
  const sleepLive = liveSleep(store.sleeps);
  const busy = !!open || !!liveAct || !!sleepLive;
  // One live thing at a time: while a session (with an exercise), an activity
  // or a sleep runs, the other starters are locked — only Resume, Health and
  // Log past (it doesn't start anything) stay open.
  const locked = (!!open && open.exercises.length > 0) || !!liveAct || !!sleepLive;
  const activeRest = activeRestPeriod(now);

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
      ? { name: programDayName(program, todayWeekday, t.progDay) }
      : null;
  const usual = programToday ? null : playForWeekday(plays, new Date(now).getDay());

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
  function beginScratch(gymId: string | null) {
    const w = startWorkout(gymId);
    done(w ? w.id : null);
  }
  async function startScratch() {
    if (resumeLive()) return onClose();
    // Standing in one of your gyms → no question, just start there. Otherwise
    // ask — the picker also finds gyms nearby that aren't saved yet.
    const here = await gymAtCurrentPosition(store.gyms);
    if (here) beginScratch(here.id);
    else setSub('gym');
  }
  function startHero() {
    if (resumeLive()) return onClose();
    if (program && programToday) {
      done(startProgramDaySession(program, todayWeekday, programToday.name));
      return;
    }
    if (usual) {
      done(startPlaySession(usual, t.defaultTimedExerciseNames.warmup));
      return;
    }
    void startScratch();
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
    if (resumeLive()) return onClose();
    setSub('activity');
  }

  let subEl: ReactNode = null;
  if (sub === 'gym')
    subEl = (
      <GymPicker gyms={store.gyms} title={t.pickGymTitle} onClose={onClose} onPick={beginScratch} />
    );
  else if (sub === 'activity') subEl = <ActivitySheet shell={shell} onClose={onClose} />;
  else if (sub === 'home')
    subEl = (
      <HomeSetSheet
        onClose={onClose}
        onStart={(input) => {
          const w = startHomeSet(input);
          done(w ? w.id : null);
        }}
      />
    );
  else if (sub === 'health')
    subEl = <RestSheet shell={shell} onClose={onClose} allowRest={!activeRest} />;
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

  const liveName = open
    ? open.dayName || t.startSessionLabel
    : liveAct
      ? (t.actType[liveAct.type] ?? liveAct.type)
      : sleepLive
        ? t.sleepTitle
        : '';
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
  const offerScratch = !busy && (!!programToday || !!usual);

  return (
    <StartFrame inline={inline} onClose={closeProp} sub={subEl}>
      <div className="ss-title">{t.startSheetTitle}</div>
      <button type="button" className="ss-hero" onClick={startHero}>
        <span className="ss-hero-text">
          <span className="ss-hero-kicker">{hero.kicker}</span>
          <span className="ss-hero-title">{hero.title}</span>
          <span className="ss-hero-sub">{hero.sub}</span>
        </span>
        <span className="ss-hero-go" aria-hidden>
          <Icon name={hero.icon} weight="fill" />
        </span>
      </button>
      {offerScratch && (
        <button type="button" className="ss-scratch" onClick={() => void startScratch()}>
          <Icon name="plus" />
          {t.startOrScratch}
        </button>
      )}
      <div className="ss-grid">
        <button
          type="button"
          className={`ss-tile${locked ? ' locked' : ''}`}
          aria-disabled={locked}
          onClick={locked ? undefined : autoBuild}
        >
          <span className="ss-tile-top">
            <span className="ss-ic tone-gold">
              <Icon name="robot" weight="regular" />
            </span>
            {locked && <Icon name="lock-simple" className="ss-lock" />}
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startAutoTitle}</span>
            <span className="ss-ts">{locked ? t.startFinishFirst(liveName) : t.startAutoSub}</span>
          </span>
        </button>
        <button
          type="button"
          className={`ss-tile${locked ? ' locked' : ''}`}
          aria-disabled={locked}
          onClick={locked ? undefined : openActivity}
        >
          <span className="ss-tile-top">
            <span className="ss-ic tone-green">
              <Icon name="heartbeat" weight="regular" />
            </span>
            {locked && <Icon name="lock-simple" className="ss-lock" />}
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startActivityTitle}</span>
            <span className="ss-ts">
              {locked ? t.startFinishFirst(liveName) : t.startActivitySub}
            </span>
          </span>
        </button>
        <button type="button" className="ss-tile" onClick={() => setSub('health')}>
          <span className="ss-ic tone-blue">
            <Icon name="clock-countdown" weight="regular" />
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startHealthTitle}</span>
            <span className="ss-ts">{t.startHealthSub}</span>
          </span>
        </button>
        <button type="button" className="ss-tile" onClick={() => setSub('past')}>
          <span className="ss-ic tone-neutral">
            <Icon name="arrow-counter-clockwise" weight="regular" />
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startPastTitle}</span>
            <span className="ss-ts">{t.startPastSub}</span>
          </span>
        </button>
        <button
          type="button"
          className={`ss-tile ss-home${locked ? ' locked' : ''}`}
          aria-disabled={locked}
          onClick={locked ? undefined : () => setSub('home')}
        >
          <span className="ss-ic tone-home">
            <Icon name="house" weight="regular" />
          </span>
          <span className="ss-tile-text">
            <span className="ss-tt">{t.startHomeTitle}</span>
            <span className="ss-ts">{locked ? t.startFinishFirst(liveName) : t.startHomeSub}</span>
          </span>
          {locked && <Icon name="lock-simple" className="ss-lock" />}
        </button>
      </div>
    </StartFrame>
  );
}

/** The Start content as a sheet (mobile) or a standing side panel (desktop). */
function StartFrame(props: {
  inline: boolean;
  onClose: () => void;
  sub: ReactNode;
  children: ReactNode;
}) {
  if (!props.inline)
    return (
      <Sheet onClose={props.onClose} className="start-sheet">
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

/** Health — sleep + rest & recovery periods (illness, full rest, rehab). While a
 *  rest period is already running only the sleep panel is offered. */
export function RestSheet({
  shell,
  onClose,
  allowRest = true,
}: {
  shell: Shell;
  onClose: () => void;
  allowRest?: boolean;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<'active' | 'off' | 'illness' | 'rehab'>('active');
  const iso = (d: Date) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const today = new Date();
  const [from, setFrom] = useState(iso(today));
  const [to, setTo] = useState(iso(new Date(today.getTime() + 6 * 86400000)));
  const [dur, setDur] = useState<'today' | 'open' | 'back'>('open');
  const [backFrom, setBackFrom] = useState(iso(today));
  const dk = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d).getTime());
  };
  const days = Math.max(1, dk(to) - dk(from) + 1);
  const start = () => {
    if (mode === 'rehab') return;
    if (mode === 'illness') {
      const tk = dayKey(Date.now());
      if (dur === 'today') startRestPeriod({ mode, startDay: tk, endDay: tk });
      else if (dur === 'open') startRestPeriod({ mode, startDay: tk, endDay: tk, open: true });
      else startRestPeriod({ mode, startDay: Math.min(dk(backFrom), tk), endDay: tk, open: true });
    } else {
      startRestPeriod({ mode, startDay: dk(from), endDay: dk(to) });
    }
    onClose();
  };
  return (
    <Sheet onClose={onClose} className="rest-sheet">
      <div className="ps-title">{t.restRecoveryTitle}</div>
      <SleepPanel shell={shell} onClose={onClose} compact />
      {allowRest && (
        <>
          <div className="section-label section-divide rest-sub">{t.restStartTitle}</div>
          <div className="rest-modes">
            {(['active', 'off', 'illness'] as const).map((m) => (
              <button
                key={m}
                className={`rest-mode${mode === m ? ' active' : ''}${m === 'illness' ? ' illness' : ''}`}
                onClick={() => setMode(m)}
              >
                <span className="rm-name">
                  {m === 'active'
                    ? t.restModeActive
                    : m === 'off'
                      ? t.restModeOff
                      : t.restModeIllness}
                </span>
                <span className="rm-desc">
                  {m === 'active'
                    ? t.restModeActiveDesc
                    : m === 'off'
                      ? t.restModeOffDesc
                      : t.restModeIllnessDesc}
                </span>
              </button>
            ))}
            <button
              className={`rest-mode rehab${mode === 'rehab' ? ' active' : ''}`}
              onClick={() => setMode('rehab')}
            >
              <span className="rmi">
                <Icon name="bandaids" weight="bold" />
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="rm-name">{t.injRestEntry}</span>
                <span className="rm-desc" style={{ display: 'block' }}>
                  {t.injRestEntryDesc}
                </span>
              </span>
            </button>
          </div>
          {mode === 'rehab' ? (
            <div className="rest-rehab-note">
              <Icon name="path" weight="bold" />
              <span>{t.injRestReplaceNote}</span>
            </div>
          ) : mode === 'illness' ? (
            <div className="ill-panel">
              <div className="ill-lbl">{t.illnessDur}</div>
              <div className="ill-seg">
                {(['today', 'open', 'back'] as const).map((d) => (
                  <button
                    key={d}
                    className={`ill-seg-b${dur === d ? ' on' : ''}`}
                    onClick={() => setDur(d)}
                  >
                    {d === 'today'
                      ? t.illnessDurToday
                      : d === 'open'
                        ? t.illnessDurOpen
                        : t.illnessDurBack}
                  </button>
                ))}
              </div>
              {dur === 'back' && (
                <label className="rest-date ill-date">
                  <span>{t.illnessBackDate}</span>
                  <input
                    type="date"
                    value={backFrom}
                    max={iso(today)}
                    onChange={(e) => setBackFrom(e.target.value)}
                  />
                </label>
              )}
              {dur === 'open' && <div className="ill-note">{t.illnessNoEnd}</div>}
            </div>
          ) : (
            <>
              <div className="rest-dates">
                <label className="rest-date">
                  <span>{t.restFrom}</span>
                  <input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="rest-date">
                  <span>{t.restTo}</span>
                  <input
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              <div className="rest-len">{t.restLength(days)}</div>
            </>
          )}
          <div className="rest-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              {t.cancel}
            </button>
            <button
              className="btn btn-primary"
              onClick={
                mode === 'rehab'
                  ? () => {
                      onClose();
                      shell.openOverlay({ screen: 'injury' });
                    }
                  : start
              }
            >
              {mode === 'rehab'
                ? t.injSetupPlan
                : mode === 'illness'
                  ? t.restStartIllness
                  : t.restStartAction}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Backfill a past session — spec docs/specs/backfill-session.md (AC-1…AC-3). */
export function BackfillSheet(props: {
  gyms: Gym[];
  onClose: () => void;
  onCreate: (startedAt: number, durationMs: number, gymId: string | null) => void;
  /** Log past → Home set: a finished home set prefilled with the chosen set. */
  onCreateHome?: (startedAt: number, durationMs: number, set: HomeSet | null) => void;
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
  const [date, setDate] = useState(defaults.date);
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
        <div className="seg2 backfill-kind" role="tablist">
          <button
            type="button"
            className={kind === 'gym' ? 'active' : ''}
            onClick={() => {
              setKind('gym');
              if (duration === HOME_BACKFILL_MIN) setDuration(60);
            }}
          >
            {t.backfillKindGym}
          </button>
          <button
            type="button"
            className={kind === 'home' ? 'active' : ''}
            onClick={() => {
              setKind('home');
              if (duration === 60) setDuration(HOME_BACKFILL_MIN);
            }}
          >
            {t.backfillKindHome}
          </button>
        </div>
      )}
      {kind === 'home' && (
        <div className="field-block">
          <span className="field-label">{t.backfillWhichHomeSet}</span>
          <div className="backfill-sets">
            {homeSets.map((hs) => (
              <button
                key={hs.id}
                type="button"
                className={`hs-mchip${homeSetId === hs.id ? ' on' : ''}`}
                onClick={() => setHomeSetId(hs.id)}
              >
                {hs.name}
              </button>
            ))}
            <button
              type="button"
              className={`hs-mchip${homeSetId === null ? ' on' : ''}`}
              onClick={() => setHomeSetId(null)}
            >
              {t.backfillHomeEmpty}
            </button>
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
          <button
            type="button"
            className="input gym-select"
            onClick={() => setGymPicker((x) => !x)}
          >
            {chosenGym ? (
              <span className="gym-select-chosen">
                <span className="thumb">
                  <GymThumb
                    name={chosenGym.name}
                    lat={chosenGym.lat}
                    lng={chosenGym.lng}
                    size={28}
                  />
                </span>
                {chosenGym.name}
              </span>
            ) : (
              <span className="gym-select-placeholder">{t.backfillGymChoose}</span>
            )}
            <Icon name={gymPicker ? 'caret-left' : 'arrow-right'} className="go" />
          </button>
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
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
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
        </button>
      </div>
    </Sheet>
  );
}
