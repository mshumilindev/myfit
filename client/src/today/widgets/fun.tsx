/**
 * Fun & tools widgets (design board L11 "Fun & tools"): a wildcard session,
 * milestone countdowns, the weekly share card, an event countdown, progress
 * photos, a personal motto, the daily check-in, an interval timer, sync status,
 * the notifications inbox and a race against last week.
 *
 * App data comes from the real modules (sessionBuilder, recovery, store,
 * notifications, calendar PRs). Things the app has no store for — the motto,
 * the event, check-ins, photos, the timer — live in tiny localStorage stores
 * (`spotter.tw.<widgetId>`) on this device only.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Field } from '../../components/ui/Field';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetList,
  WidgetRing,
  WidgetStats,
  WidgetEmpty,
} from '../../components/ui/Widget';
import type { WidgetSize } from '../../components/ui/Widget';
import { Button, IconButton } from '../../components/ui/Button';
import { IconTile } from '../../components/ui/IconTile';
import { Segmented } from '../../components/ui/Segmented';
import { localizedExerciseName } from '../../data/exerciseNames';
import { toneClass, type Tone } from '../../components/ui/tones';
import { dayOfTimestamp, dayKeyOf, timestampOfDay, ymdOf } from '../../components/ui/calendarDays';
import { ExerciseName, Sheet } from '../../ui';
import {
  consistencyStreak,
  latestWeight,
  pickSessionGym,
  retrySync,
  startGeneratedDay,
  workoutVolumeKg,
  type StoreState,
} from '../../store';
import { buildDay, type GeneratedDay } from '../../sessionBuilder';
import { muscleReadiness } from '../../recovery';
import { healthBuildCtx } from '../../healthBuild';
import { describeDay, dayReadoutLabel } from '../../data/daySuggest';
import type { MuscleGroup } from '../../data/exercises';
import {
  isSeen,
  markAllNotifsSeen,
  notifTime,
  unreadCount,
  useNotifs,
  type Notif,
} from '../../notifications';
import { weekStartOf } from '../../weekStart';
import {
  fmtBodyWeightKg,
  fmtDayMonth,
  fmtWeekdayDayMonth,
  fmtWeekdayShort,
  getLocale,
  type LocaleId,
} from '../../i18n';
import type { Workout } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY, clock, signed } from './format';
import { prRecords } from '../calendarData';
import { fs, type FunStrings } from './fun.strings';
import { Textarea } from '../../components/ui/Textarea';

/* ---------------------------------------------------------------------------
 * Tiny local stores (this device only)
 * ------------------------------------------------------------------------- */

interface LocalStore<T> {
  read: () => T;
  write: (v: T) => boolean;
  subscribe: (cb: () => void) => () => void;
}

function localStore<T>(id: string, fallback: T): LocalStore<T> {
  const key = `spotter.tw.${id}`;
  const listeners = new Set<() => void>();
  let cache: { v: T } | null = null;
  const read = (): T => {
    if (cache) return cache.v;
    let v = fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw) v = JSON.parse(raw) as T;
    } catch {
      /* private mode / bad JSON — start empty */
    }
    cache = { v };
    return v;
  };
  const write = (v: T): boolean => {
    cache = { v };
    let ok = true;
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      ok = false; // quota — keep it for this session only
    }
    for (const l of listeners) l();
    return ok;
  };
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };
  return { read, write, subscribe };
}

function useLocal<T>(s: LocalStore<T>): T {
  return useSyncExternalStore(s.subscribe, s.read, s.read);
}

/* ---------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------- */

const muted: CSSProperties = {
  fontSize: 'var(--fs-12)',
  color: 'var(--color-text-muted)',
  lineHeight: 1.4,
};

function finished(store: StoreState): Workout[] {
  return store.workouts.filter((w) => w.finishedAt !== null);
}

function tons(kg: number): string {
  return (kg / 1000).toFixed(1);
}

/** 1284 → "1 284". */
function fmtInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** ISO week number of a timestamp. */
function isoWeek(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 3);
  const firstThu = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d.getTime() - firstThu.getTime()) / DAY - 3 + ((firstThu.getDay() + 6) % 7)) / 7)
  );
}

/** Empty / invite card in any size — the kit's WidgetEmpty (+ an optional sheet). */
function Invite({
  size,
  tone,
  icon,
  kicker,
  title,
  sub,
  action,
  onAction,
  extra,
}: {
  size: WidgetSize;
  tone: Tone;
  icon: string;
  kicker: string;
  title: string;
  sub?: string;
  action?: string;
  onAction: () => void;
  extra?: ReactNode;
}) {
  return (
    <>
      <WidgetEmpty
        size={size}
        tone={tone}
        icon={icon}
        kicker={kicker}
        title={title}
        sub={sub}
        action={action}
        onAction={onAction}
      />
      {extra}
    </>
  );
}

/** A small bottom sheet with a title, a body and Save / Cancel (/ Remove). */
function FormSheet({
  title,
  children,
  onClose,
  onSave,
  onRemove,
  s,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: () => void;
  onRemove?: () => void;
  s: FunStrings;
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head">
        <span className="t">{title}</span>
      </div>
      <div className="ul-flex ul-col ug-12 umb-16">{children}</div>
      <div className="sheet-actions">
        {onRemove && (
          <Button variant="danger" onClick={onRemove}>
            {s.remove}
          </Button>
        )}
        <Button variant="secondary" fullWidth onClick={onClose}>
          {s.cancel}
        </Button>
        <Button variant="fill" fullWidth onClick={onSave}>
          {s.save}
        </Button>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------------
 * Wildcard session
 * ------------------------------------------------------------------------- */

/** Rolls after the first (auto) pick: coherent muscle sets to try in turn. */
const PRESETS: MuscleGroup[][] = [
  ['biceps', 'triceps', 'forearms'],
  ['chest', 'shoulders', 'triceps'],
  ['lats', 'traps', 'biceps'],
  ['quads', 'hamstrings', 'glutes', 'calves'],
  ['shoulders', 'traps', 'core'],
  ['glutes', 'hamstrings', 'core'],
];

interface Wildcard {
  day: GeneratedDay;
  readiness: number;
  resting: MuscleGroup[];
}

function wildcardFor(
  store: Pick<
    StoreState,
    'workouts' | 'activities' | 'bodyMetrics' | 'goals' | 'injuries' | 'conditions'
  >,
  now: number,
  roll: number,
): Wildcard | null {
  const done = store.workouts.filter((w) => w.finishedAt !== null);
  if (done.length < 2) return null;
  const ready = muscleReadiness(done, now);
  const health = healthBuildCtx(store, now);
  const prot = new Set(health.protectedMuscles);
  const usable = (m: MuscleGroup) => !prot.has(m) && ready.get(m)?.state !== 'recovering';
  let target: MuscleGroup[] | undefined;
  if (roll > 0) {
    for (let i = 0; i < PRESETS.length; i++) {
      const p = PRESETS[(roll - 1 + i) % PRESETS.length].filter(usable);
      if (p.length >= 2) {
        target = p;
        break;
      }
    }
  }
  const day = buildDay({
    finished: done,
    activities: store.activities,
    body: store.bodyMetrics,
    goals: store.goals,
    gym: pickSessionGym(),
    now,
    intent: 'muscle',
    targetMuscles: target,
    ...health,
    lengthMin: 35,
    warmup: false,
    cardio: false,
    cooldown: false,
    bodyKg: latestWeight(store.bodyMetrics)?.weight ?? null,
    sex: store.bodyMetrics.sex,
  });
  if (day.main.length === 0) return null;
  const rs = day.targetMuscles.map((m) => ready.get(m)?.readiness ?? 1);
  const readiness = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 1;
  const resting = [...ready.values()]
    .filter((r) => r.state === 'recovering' && !day.targetMuscles.includes(r.muscle))
    .map((r) => r.muscle);
  return { day, readiness, resting };
}

function WildcardWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale, shell } = ctx;
  const s = fs(locale);
  const [roll, setRoll] = useState(0);
  const { workouts, activities, bodyMetrics, goals, injuries, conditions } = store;
  const wc = useMemo(
    () =>
      wildcardFor({ workouts, activities, bodyMetrics, goals, injuries, conditions }, now, roll),
    [workouts, activities, bodyMetrics, goals, injuries, conditions, now, roll],
  );
  if (!wc)
    return (
      <Invite
        size={size}
        tone="accent"
        icon="sparkle"
        kicker={s.wildcardShort}
        title={s.noWildcard}
        action={s.startSession}
        onAction={shell.openStart}
      />
    );
  const { day } = wc;
  const readout = describeDay(day.coverage.map((c) => [c.muscle, c.sets] as [MuscleGroup, number]));
  const name = readout ? dayReadoutLabel(readout, t) : day.dayName;
  const min = Math.round(day.estMinutes);
  const n = day.main.length;
  const pct = Math.round(wc.readiness * 100);
  const muscles = day.targetMuscles.map((m) => t.muscleGroups[m] ?? m);
  const resting = wc.resting.slice(0, 2).map((m) => t.muscleGroups[m] ?? m);
  const restLine = resting.length ? s.staysResting(resting.join(', ')) : s.allFresh;
  const reroll = () => setRoll((r) => r + 1);
  const start = () => {
    const gym = pickSessionGym();
    const w = startGeneratedDay(day, gym?.id ?? null);
    if (w) shell.openOverlay({ screen: 'session', workoutId: w.id });
  };
  const open = () => shell.openOverlay({ screen: 'builder' });
  const rerollBtn = (
    <Button variant="secondary" size="sm" icon="arrows-clockwise" onClick={reroll}>
      {s.reroll}
    </Button>
  );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="sparkle"
        title={s.wildcardTitle(name)}
        sub={s.fitsReadiness(min, pct)}
        onClick={open}
        trailing={
          <IconButton icon="arrows-clockwise" label={s.reroll} size="sm" onClick={reroll} />
        }
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="accent"
        kicker={s.wildcardShort}
        title={name}
        sub={s.minExercises(min, n)}
        onClick={open}
        footer={rerollBtn}
      />
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="accent"
        kicker={s.wildcardShort}
        badge={s.minExercises(min, n)}
        title={name}
        sub={`${muscles.join(' · ')} — ${restLine}`}
        onClick={open}
        footer={
          <>
            {rerollBtn}
            <Button variant="primary" size="sm" iconTrailing="caret-right" onClick={start}>
              {s.start}
            </Button>
          </>
        }
      />
    );
  const gym = pickSessionGym();
  return (
    <Widget
      size="XL"
      tone="accent"
      kicker={s.wildcard}
      badge={s.roll(roll + 1)}
      title={`${name} · ${min} min`}
      sub={`${s.why(muscles.join(', '), pct)}${gym ? ` ${s.whyGym(gym.name)}` : ''}`}
      bodyLast
      onClick={open}
      footer={
        <>
          {rerollBtn}
          <Button variant="primary" size="sm" fullWidth iconTrailing="caret-right" onClick={start}>
            {s.startSession}
          </Button>
        </>
      }
    >
      <WidgetList
        rows={day.main.slice(0, 5).map((ex) => ({
          label: <ExerciseName name={ex.name} secondary={false} />,
          value: `${ex.sets} × ${ex.repLow === ex.repHigh ? ex.repLow : `${ex.repLow}–${ex.repHigh}`}${
            ex.targetWeight ? ` · ${ex.targetWeight} kg` : ''
          }`,
        }))}
      />
    </Widget>
  );
}

const wildcard: WidgetDef = {
  id: 'wildcard',
  group: 'fun',
  icon: 'sparkle',
  tone: 'accent',
  name: () => fs(getLocale()).wildcard,
  render: (size, ctx) => <WildcardWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Milestone countdown
 * ------------------------------------------------------------------------- */

const SESSION_STEPS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
const STREAK_STEPS = [7, 14, 30, 50, 100, 150, 200, 300, 365, 500, 730, 1000];

function nextStep(v: number, steps: number[], every: number): number {
  return steps.find((x) => x > v) ?? (Math.floor(v / every) + 1) * every;
}

interface Milestone {
  key: string;
  label: string;
  value: string;
  frac: number;
  eta: number | null;
  reached?: boolean;
}

const milestones: WidgetDef = {
  id: 'milestones',
  group: 'fun',
  icon: 'target',
  tone: 'accent',
  name: () => fs(getLocale()).milestones,
  render: (size, { store, now, locale, shell }) => {
    const s = fs(locale);
    const done = finished(store);
    const n = done.length;
    const kg = done.reduce((a, w) => a + workoutVolumeKg(w), 0);
    const recent = done.filter((w) => w.startedAt >= now - 28 * DAY);
    const perWeek = recent.length / 4;
    const kgPerDay = recent.reduce((a, w) => a + workoutVolumeKg(w), 0) / 28;
    const sTarget = nextStep(n, SESSION_STEPS, 500);
    const sLeft = sTarget - n;
    const sEta = perWeek > 0 ? now + (sLeft / perWeek) * 7 * DAY : null;
    const t = kg / 1000;
    const tStep = t < 10 ? 5 : t < 100 ? 25 : t < 1000 ? 100 : 250;
    const tTarget = (Math.floor(t / tStep) + 1) * tStep;
    const tLeftKg = tTarget * 1000 - kg;
    const tEta = kgPerDay > 0 ? now + (tLeftKg / kgPerDay) * DAY : null;
    const streak = consistencyStreak(now);
    const stTarget = nextStep(streak, STREAK_STEPS, 365);
    const list: Milestone[] = [
      {
        key: 'sessions',
        label: s.sessionsTo(sLeft, sTarget),
        value: `${n} / ${sTarget}`,
        frac: n / sTarget,
        eta: sEta,
      },
      ...(kg > 0
        ? [
            {
              key: 'tons',
              label: s.tonsTo(fmtInt(tLeftKg / 1000), fmtInt(tTarget)),
              value: `${fmtInt(t)} t`,
              frac: t / tTarget,
              eta: tEta,
            },
          ]
        : []),
      ...(streak > 0
        ? [
            {
              key: 'streak',
              label: s.streakTo(stTarget - streak, stTarget),
              value: `${streak} / ${stTarget}`,
              frac: streak / stTarget,
              eta: now + (stTarget - streak) * DAY,
            },
          ]
        : []),
    ];
    const byEta = [...list].sort((a, b) => (a.eta ?? Infinity) - (b.eta ?? Infinity));
    const inReach = list.filter((m) => m.eta !== null && m.eta - now < 45 * DAY).length;
    const etaTxt = (e: number | null) => (e ? `~${fmtDayMonth(e, locale)}` : '—');
    const open = () => shell.goTab('progress');
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.nextMilestone}
          value={sLeft}
          unit={s.sessionsUnit}
          sub={s.toSessions(sTarget)}
          onClick={open}
          bodyLast
        >
          <WidgetBar value={n / sTarget} />
        </Widget>
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="target"
          title={s.sessionsTo(sLeft, sTarget)}
          sub={sEta ? s.doneAbout(n, fmtDayMonth(sEta, locale)) : s.doneN(n)}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" kicker={s.milestonesK} onClick={open}>
          <WidgetList rows={byEta.slice(0, 2).map((m) => ({ label: m.label, value: m.value }))} />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.milestonesK}
        badge={s.inReach(inReach)}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" iconTrailing="caret-right" onClick={open}>
            {s.allMilestones}
          </Button>
        }
      >
        <div className="ul-flex ua-center ug-16">
          <WidgetRing value={n / sTarget} size={96}>
            {n}
            <small>{s.ofN(sTarget)}</small>
          </WidgetRing>
          <div className="umw-0 ul-flex ul-col ug-4">
            <div className="uiw-t-lg">{s.sessionsTo(sLeft, sTarget)}</div>
            {sEta && (
              <div style={muted}>
                {s.atPace(perWeek.toFixed(perWeek % 1 ? 1 : 0), fmtWeekdayDayMonth(sEta, locale))}
              </div>
            )}
          </div>
        </div>
        <WidgetList
          rows={[...byEta.map((m) => ({ label: m.label, value: etaTxt(m.eta) }))].slice(0, 4)}
        />
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Share card (this training week)
 * ------------------------------------------------------------------------- */

function weekSummary(store: StoreState, now: number) {
  const ws = weekStartOf(now);
  const list = finished(store).filter((w) => w.startedAt >= ws && w.startedAt <= now);
  const kg = list.reduce((a, w) => a + workoutVolumeKg(w), 0);
  const best = new Map<string, { name: string; e1rm: number }>();
  for (const p of prRecords(store.workouts)) {
    if (p.at < ws || p.at > now) continue;
    const k = p.name.toLowerCase();
    if ((best.get(k)?.e1rm ?? 0) < p.e1rm) best.set(k, { name: p.name, e1rm: p.e1rm });
  }
  const prs = [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
  return { ws, list, kg, prs, week: isoWeek(now) };
}

async function shareWeek(text: string, ctx: WidgetCtx, s: FunStrings) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Spotter', text });
      return;
    }
    await navigator.clipboard.writeText(text);
    ctx.shell.toast({ kind: 'ok', icon: 'copy', text: s.copied });
  } catch {
    /* user cancelled the share sheet */
  }
}

/** The card itself — a toned surface with the week's numbers. */
function WeekCard({
  n,
  kg,
  prs,
  week,
  s,
  big,
}: {
  n: number;
  kg: number;
  prs: number;
  week: number;
  s: FunStrings;
  big?: boolean;
}) {
  const stat = (v: ReactNode, l: string) => (
    <div className="ul-flex ul-col ug-2">
      <span
        className="ut-w8"
        style={{ fontSize: big ? 'var(--fs-30)' : 'var(--fs-22)', lineHeight: 1 }}
      >
        {v}
      </span>
      <span className="uiw-t-sm tw-tone-text">{l}</span>
    </div>
  );
  return (
    <div
      className={[[toneClass('accent'), 'ur-lg'].filter(Boolean).join(' '), 'tw-tint-card']
        .filter(Boolean)
        .join(' ')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: big ? 12 : 8,
        padding: big ? 14 : 10,
        minWidth: 0,
      }}
    >
      <span className="uiw-t-xs ut-tone tw-caps-wide">SPOTTER · {s.weekN(week).toUpperCase()}</span>
      <div className="ul-flex" style={{ gap: big ? 24 : 14 }}>
        {stat(n, s.sessionsShort)}
        {stat(tons(kg), `t ${s.lifted}`)}
        {stat(prs, s.prs)}
      </div>
    </div>
  );
}

const shareCard: WidgetDef = {
  id: 'share-card',
  group: 'fun',
  icon: 'share-network',
  tone: 'accent',
  name: () => fs(getLocale()).shareCard,
  render: (size, ctx) => {
    const { store, now, locale, shell } = ctx;
    const s = fs(locale);
    const w = weekSummary(store, now);
    const n = w.list.length;
    const open = () => shell.openOverlay({ screen: 'history' });
    if (n === 0)
      return (
        <Invite
          size={size}
          tone="accent"
          icon="share-network"
          kicker={s.weekN(w.week)}
          title={s.emptyWeek}
          action={s.startSession}
          onAction={shell.openStart}
        />
      );
    const text = s.shareText(w.week, n, tons(w.kg), w.prs.length);
    const share = () => void shareWeek(text, ctx, s);
    const line = `${tons(w.kg)} t · ${s.prsN(w.prs.length)}`;
    const shareBtn = (full?: boolean) => (
      <Button variant="primary" size="sm" icon="share-network" fullWidth={full} onClick={share}>
        {s.share}
      </Button>
    );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={`${s.weekN(w.week)} · SPOTTER`}
          value={n}
          unit={s.sessionsShort}
          sub={line}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="share-network"
          title={s.cardReady(w.week)}
          sub={`${n} ${s.sessionsShort} · ${line}`}
          onClick={open}
          trailing={shareBtn()}
        />
      );
    const range = `${fmtDayMonth(w.ws, locale)} – ${fmtDayMonth(w.ws + 6 * DAY + DAY / 2, locale)}`;
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.yourWeekCard}
          badge={range}
          onClick={open}
          footer={shareBtn()}
        >
          <WeekCard n={n} kg={w.kg} prs={w.prs.length} week={w.week} s={s} />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.shareYourWeek}
        badge={range}
        onClick={open}
        footer={shareBtn(true)}
      >
        <WeekCard n={n} kg={w.kg} prs={w.prs.length} week={w.week} s={s} big />
        {w.prs.length > 0 && (
          <WidgetList
            rows={w.prs.slice(0, 3).map((p) => ({
              icon: 'arrow-up',
              tone: 'accent' as Tone,
              label: <ExerciseName name={p.name} secondary={false} />,
              value: `${Math.round(p.e1rm)} kg e1RM`,
            }))}
          />
        )}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Event countdown (user-set date)
 * ------------------------------------------------------------------------- */

interface EventData {
  name: string;
  /** YYYY-MM-DD */
  date: string;
  meet: boolean;
  /** Day key the countdown was set. */
  setDay: number;
}

const eventStore = localStore<EventData | null>('event-countdown', null);

function dayOfIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? dayKeyOf(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function isoOfDay(day: number): string {
  const { y, m, d } = ymdOf(day);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function EventSheet({
  initial,
  today,
  s,
  onClose,
}: {
  initial: EventData | null;
  today: number;
  s: FunStrings;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? isoOfDay(today + 30));
  const [meet, setMeet] = useState(initial?.meet ?? false);
  const save = () => {
    if (dayOfIso(date) === null) return;
    eventStore.write({
      name: name.trim(),
      date,
      meet,
      setDay: initial && initial.date === date ? initial.setDay : today,
    });
    onClose();
  };
  return (
    <FormSheet
      title={initial ? s.editEvent : s.setEvent}
      s={s}
      onClose={onClose}
      onSave={save}
      onRemove={
        initial
          ? () => {
              eventStore.write(null);
              onClose();
            }
          : undefined
      }
    >
      <Field
        label={s.eventName}
        value={name}
        maxLength={60}
        placeholder={s.defaultEvent}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label={s.eventDate}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Segmented
        options={[
          { value: 'meet', label: s.kindMeet },
          { value: 'other', label: s.kindOther },
        ]}
        value={meet ? 'meet' : 'other'}
        onChange={(v) => setMeet(v === 'meet')}
      />
    </FormSheet>
  );
}

function EventWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { now, locale, store } = ctx;
  const s = fs(locale);
  const ev = useLocal(eventStore);
  const [editing, setEditing] = useState(false);
  const today = dayOfTimestamp(now);
  const edit = () => setEditing(true);
  const sheet = editing ? (
    <EventSheet initial={ev} today={today} s={s} onClose={() => setEditing(false)} />
  ) : null;
  const evDay = ev ? dayOfIso(ev.date) : null;
  if (!ev || evDay === null)
    return (
      <Invite
        size={size}
        tone="accent"
        icon="flag-checkered"
        kicker={s.countdown}
        title={s.setEvent}
        sub={s.setEventHint}
        action={s.setEvent}
        onAction={edit}
        extra={sheet}
      />
    );
  const name = ev.name || s.defaultEvent;
  const left = evDay - today;
  const ts = timestampOfDay(evDay);
  const dateTxt = fmtWeekdayDayMonth(ts, locale);
  const short = fmtDayMonth(ts, locale);
  const headline =
    left > 0 ? s.inDays(name, left) : left === 0 ? s.eventToday(name) : s.eventPast(-left);
  const span = Math.max(1, evDay - ev.setDay);
  const frac = Math.min(1, Math.max(0, (today - ev.setDay) / span));
  // Meet phases: build → peak (D-13…D-7) → deload (D-6…D-1).
  const phases = ev.meet
    ? [
        { key: 'build', label: s.build, hint: s.buildHint, from: ev.setDay, to: evDay - 14 },
        { key: 'peak', label: s.peak, hint: s.peakHint, from: evDay - 13, to: evDay - 7 },
        { key: 'deload', label: s.deload, hint: s.deloadHint, from: evDay - 6, to: evDay - 1 },
      ]
    : [];
  const value = Math.abs(left);
  let out: ReactNode;
  if (size === 'S')
    out = (
      <Widget
        size="S"
        tone="accent"
        kicker={name}
        value={value}
        unit={s.daysUnit}
        sub={short}
        onClick={edit}
      />
    );
  else if (size === 'M')
    out = (
      <Widget
        size="M"
        tone="accent"
        icon="flag-checkered"
        title={headline}
        sub={dateTxt}
        onClick={edit}
      />
    );
  else {
    const bar = (
      <div className="ul-flex ul-col ug-4">
        <WidgetBar value={frac} height={8} />
        <div className="uiw-t-xs ul-flex uj-between" style={{ ...muted }}>
          <span>{fmtDayMonth(timestampOfDay(ev.setDay), locale)}</span>
          <span>{s.todayWord}</span>
          <span>{short}</span>
        </div>
      </div>
    );
    if (size === 'L')
      out = (
        <Widget
          size="L"
          tone="accent"
          kicker={s.countdownK(dateTxt)}
          value={value}
          unit={s.daysUnit}
          sub={name}
          bodyLast
          onClick={edit}
        >
          {bar}
        </Widget>
      );
    else {
      const kg = latestWeight(store.bodyMetrics)?.weight;
      out = (
        <Widget
          size="XL"
          tone="accent"
          kicker={s.countdownK(dateTxt)}
          value={value}
          unit={s.daysUnit}
          title={name}
          sub={ev.meet && kg ? s.youWeigh(fmtBodyWeightKg(kg)) : undefined}
          bodyLast
          onClick={edit}
          footer={
            <Button variant="primary" size="sm" icon="pencil-simple" onClick={edit}>
              {s.editEvent}
            </Button>
          }
        >
          {bar}
          {phases.length > 0 && (
            <WidgetList
              rows={phases.map((p) => {
                const on = today >= p.from && today <= p.to;
                return {
                  label: (
                    <span style={{ color: on ? 'var(--color-accent)' : undefined }}>
                      {p.label} · {p.hint}
                    </span>
                  ),
                  value: `${fmtDayMonth(timestampOfDay(Math.max(p.from, ev.setDay)), locale)} – ${fmtDayMonth(
                    timestampOfDay(p.to),
                    locale,
                  )}`,
                };
              })}
            />
          )}
        </Widget>
      );
    }
  }
  return (
    <>
      {out}
      {sheet}
    </>
  );
}

const eventCountdown: WidgetDef = {
  id: 'event-countdown',
  group: 'fun',
  icon: 'flag-checkered',
  tone: 'accent',
  name: () => fs(getLocale()).eventCountdown,
  render: (size, ctx) => <EventWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Progress photos (downscaled, on this device only)
 * ------------------------------------------------------------------------- */

interface Photo {
  id: string;
  at: number;
  url: string;
  kg: number | null;
}

const photoStore = localStore<Photo[]>('progress-photos', []);
const MAX_PHOTOS = 24;

/** Read an image file and downscale it to a ~480px JPEG data URL. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const k = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        const g = c.getContext('2d');
        if (!g) return reject(new Error('canvas'));
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function Thumb({ photo, label, h }: { photo: Photo | undefined; label?: string; h: number }) {
  return (
    <div className="uf-1 umw-0 ul-flex ul-col ug-4">
      {photo ? (
        <img
          src={photo.url}
          alt={label ?? ''}
          className="ur-md tw-photo-fill uw-full ul-block"
          style={{ height: h, objectFit: 'cover' }}
        />
      ) : (
        <div className="ur-md tw-photo-empty ul-grid" style={{ height: h, placeItems: 'center' }}>
          <IconTile outline size={30} icon="camera" />
        </div>
      )}
      {label && (
        <span className="uiw-t-sm" style={{ ...muted }}>
          {label}
        </span>
      )}
    </div>
  );
}

function PhotosWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, locale, shell } = ctx;
  const s = fs(locale);
  const photos = useLocal(photoStore);
  const input = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(false);
  const pick = () => input.current?.click();
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await downscale(file);
      const at = Date.now();
      const kg = latestWeight(store.bodyMetrics)?.weight ?? null;
      const list = [...photoStore.read(), { id: crypto.randomUUID(), at, url, kg }];
      const kept = list.length > MAX_PHOTOS ? [list[0], ...list.slice(-(MAX_PHOTOS - 1))] : list;
      if (!photoStore.write(kept)) throw new Error('quota');
    } catch {
      shell.toast({ kind: 'danger', icon: 'warning-circle', text: s.photoFailed });
    }
  };
  const extra = (
    <>
      {/* kit-ok: hidden file input */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => void onFile(e)}
      />
      {gallery && (
        <Sheet onClose={() => setGallery(false)}>
          <div className="sheet-head">
            <span className="t">{s.photosTitle}</span>
          </div>
          <div
            className="ul-grid ug-8 umb-16"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            {[...photos].reverse().map((p) => (
              <div key={p.id} className="ul-flex ul-col ug-4">
                <Thumb
                  photo={p}
                  h={120}
                  label={`${fmtDayMonth(p.at, locale)}${p.kg ? ` · ${p.kg} kg` : ''}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  onClick={() => photoStore.write(photoStore.read().filter((x) => x.id !== p.id))}
                >
                  {s.deletePhoto}
                </Button>
              </div>
            ))}
          </div>
          <Button variant="primary" fullWidth icon="camera" onClick={pick}>
            {s.newPhoto}
          </Button>
        </Sheet>
      )}
    </>
  );
  if (photos.length === 0)
    return (
      <Invite
        size={size}
        tone="neutral"
        icon="camera"
        kicker={s.thenNow}
        title={s.firstPhoto}
        sub={s.photosLocal}
        action={s.addPhoto}
        onAction={pick}
        extra={extra}
      />
    );
  const first = photos[0];
  const last = photos[photos.length - 1];
  const two = photos.length > 1;
  const days = Math.round((last.at - first.at) / DAY);
  const dkg = two && first.kg && last.kg ? last.kg - first.kg : null;
  const kgTxt = dkg !== null ? `${signed(dkg)} kg` : null;
  const next = last.at + 30 * DAY;
  const nextTxt = fmtDayMonth(next, locale);
  const open = () => setGallery(true);
  const addBtn = (
    <Button variant="secondary" size="sm" icon="plus" onClick={pick}>
      {s.addPhoto}
    </Button>
  );
  const facts = [s.daysN(days), kgTxt].filter(Boolean).join(' · ');
  let out: ReactNode;
  if (size === 'S')
    out = (
      <Widget
        size="S"
        tone="neutral"
        kicker={s.thenNow}
        sub={two ? facts : fmtDayMonth(first.at, locale)}
        onClick={open}
      >
        <div className="ul-flex ug-6 uf-1" style={{ minHeight: 0 }}>
          <Thumb photo={first} h={70} />
          <Thumb photo={two ? last : undefined} h={70} />
        </div>
      </Widget>
    );
  else if (size === 'M')
    out = (
      <Widget
        size="M"
        tone="neutral"
        icon="camera"
        title={s.photosTitle}
        sub={`${facts} · ${s.nextOn(nextTxt)}`}
        onClick={open}
        trailing={addBtn}
      />
    );
  else if (size === 'L')
    out = (
      <Widget size="L" tone="neutral" onClick={open}>
        <div className="ul-flex ug-12 uf-1" style={{ minHeight: 0 }}>
          <div className="ul-flex ug-6" style={{ width: '46%' }}>
            <Thumb photo={first} h={96} label={fmtDayMonth(first.at, locale)} />
            <Thumb
              photo={two ? last : undefined}
              h={96}
              label={two ? fmtDayMonth(last.at, locale) : undefined}
            />
          </div>
          <div className="uf-1 umw-0 ul-flex ul-col ug-4">
            <span className="uiw-kicker">{s.progress}</span>
            <span className="uiw-t-xl">{s.daysN(days)}</span>
            {kgTxt && <WidgetDelta good={(dkg ?? 0) <= 0}>{kgTxt}</WidgetDelta>}
            {first.kg && last.kg && two && (
              <span style={muted}>
                {first.kg} → {last.kg} kg
              </span>
            )}
            <div className="umt-auto" style={{ pointerEvents: 'auto' }}>
              {addBtn}
            </div>
          </div>
        </div>
      </Widget>
    );
  else {
    const sessions = finished(store).filter(
      (w) => w.startedAt >= first.at && w.startedAt <= now,
    ).length;
    const cap = (p: Photo) => `${fmtDayMonth(p.at, locale)}${p.kg ? ` · ${p.kg} kg` : ''}`;
    out = (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.photosTitle}
        onClick={open}
        footer={
          <div className="ul-flex ua-center ug-8 uw-full">
            <span className="uf-1" style={{ ...muted }}>
              {s.nextReminder} {nextTxt}
            </span>
            <Button variant="primary" size="sm" icon="camera" onClick={pick}>
              {s.newPhoto}
            </Button>
          </div>
        }
      >
        <div className="ul-flex ug-8 uf-1" style={{ minHeight: 0 }}>
          <Thumb photo={first} h={150} label={cap(first)} />
          <Thumb photo={two ? last : undefined} h={150} label={two ? cap(last) : undefined} />
        </div>
        <WidgetStats
          items={[
            { label: s.time, value: s.daysN(days) },
            { label: s.weight, value: kgTxt ?? '—' },
            { label: s.sessions, value: sessions },
          ]}
        />
      </Widget>
    );
  }
  return (
    <>
      {out}
      {extra}
    </>
  );
}

const progressPhotos: WidgetDef = {
  id: 'progress-photos',
  group: 'fun',
  icon: 'camera',
  tone: 'neutral',
  name: () => fs(getLocale()).progressPhotos,
  render: (size, ctx) => <PhotosWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Personal motto
 * ------------------------------------------------------------------------- */

interface MottoData {
  text: string;
  since: number;
  history: { text: string; from: number; to: number }[];
}

const mottoStore = localStore<MottoData | null>('motto', null);

function MottoSheet({
  cur,
  s,
  onClose,
}: {
  cur: MottoData | null;
  s: FunStrings;
  onClose: () => void;
}) {
  const [text, setText] = useState(cur?.text ?? '');
  const save = () => {
    const v = text.trim();
    const at = Date.now();
    if (!v) mottoStore.write(null);
    else if (!cur) mottoStore.write({ text: v, since: at, history: [] });
    else if (v !== cur.text)
      mottoStore.write({
        text: v,
        since: at,
        history: [{ text: cur.text, from: cur.since, to: at }, ...cur.history].slice(0, 5),
      });
    onClose();
  };
  return (
    <FormSheet
      title={cur ? s.editMotto : s.setMotto}
      s={s}
      onClose={onClose}
      onSave={save}
      onRemove={
        cur
          ? () => {
              mottoStore.write(null);
              onClose();
            }
          : undefined
      }
    >
      <Textarea
        rows={3}
        maxLength={140}
        value={text}
        placeholder={s.mottoPlaceholder}
        onChange={(e) => setText(e.target.value)}
      />
    </FormSheet>
  );
}

function Quote({ text, big }: { text: string; big?: boolean }) {
  return (
    <div className="ul-flex ul-col ug-2 umw-0">
      <span
        className={[toneClass('accent'), 'ut-tone ut-w7'].filter(Boolean).join(' ')}
        style={{
          fontSize: big ? 'var(--fs-40)' : 'var(--fs-30)',
          lineHeight: 0.8,
        }}
      >
        “
      </span>
      <span
        className="ut-w7"
        style={{
          fontSize: big ? 'var(--fs-22)' : 'var(--fs-16)',
          lineHeight: 1.25,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: big ? 4 : 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {text}
      </span>
    </div>
  );
}

function MottoWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, locale } = ctx;
  const s = fs(locale);
  const m = useLocal(mottoStore);
  const [editing, setEditing] = useState(false);
  const edit = () => setEditing(true);
  const sheet = editing ? <MottoSheet cur={m} s={s} onClose={() => setEditing(false)} /> : null;
  if (!m)
    return (
      <Invite
        size={size}
        tone="accent"
        icon="pencil-simple-line"
        kicker={s.myMotto}
        title={s.setMotto}
        sub={s.mottoHint}
        action={s.setMotto}
        onAction={edit}
        extra={sheet}
      />
    );
  const since = fmtDayMonth(m.since, locale);
  let out: ReactNode;
  if (size === 'M')
    out = (
      <Widget
        size="M"
        tone="accent"
        icon="pencil-simple-line"
        title={m.text}
        sub={s.myMotto}
        onClick={edit}
      />
    );
  else if (size === 'S')
    out = (
      <Widget size="S" tone="accent" onClick={edit}>
        <Quote text={m.text} />
      </Widget>
    );
  else if (size === 'L')
    out = (
      <Widget size="L" tone="accent" sub={s.writtenOn(since)} onClick={edit}>
        <Quote text={m.text} />
      </Widget>
    );
  else {
    const n = finished(store).filter((w) => w.startedAt >= m.since).length;
    out = (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.myMotto}
        badge={s.sinceSessions(since, n)}
        onClick={edit}
        footer={
          <Button variant="primary" size="sm" icon="pencil-simple" onClick={edit}>
            {s.editMotto}
          </Button>
        }
      >
        <div className="uf-1 ul-flex ua-center">
          <Quote text={m.text} big />
        </div>
        {m.history.length > 0 && (
          <>
            <span className="uiw-kicker ut-muted">{s.earlierMottos}</span>
            <WidgetList
              rows={m.history.slice(0, 2).map((h) => ({
                label: h.text,
                value: `${fmtDayMonth(h.from, locale)} – ${fmtDayMonth(h.to, locale)}`,
              }))}
            />
          </>
        )}
      </Widget>
    );
  }
  return (
    <>
      {out}
      {sheet}
    </>
  );
}

const motto: WidgetDef = {
  id: 'motto',
  group: 'fun',
  icon: 'pencil-simple-line',
  tone: 'accent',
  name: () => fs(getLocale()).motto,
  render: (size, ctx) => <MottoWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Daily check-in (1–5 + note)
 * ------------------------------------------------------------------------- */

interface CheckIn {
  score: number;
  note: string;
  at: number;
}

const checkStore = localStore<Record<string, CheckIn>>('daily-check-in', {});

function setCheck(day: number, patch: Partial<CheckIn>) {
  const all = checkStore.read();
  const prev = all[day];
  const next: CheckIn = {
    score: patch.score ?? prev?.score ?? 3,
    note: patch.note ?? prev?.note ?? '',
    at: prev?.at ?? Date.now(),
  };
  // Keep the last ~120 days.
  const kept: Record<string, CheckIn> = Object.fromEntries(
    Object.entries<CheckIn>({ ...all, [day]: next }).filter(([k]) => Number(k) > day - 120),
  );
  checkStore.write(kept);
}

function ScoreRow({
  value,
  onPick,
  labels,
  small,
}: {
  value: number | null;
  onPick: (n: number) => void;
  labels?: string[];
  small?: boolean;
}) {
  return (
    <div style={{ width: small ? undefined : '100%' }}>
      <Segmented
        variant="buttons"
        tone="ok"
        size={small ? 'sm' : 'md'}
        value={value}
        onChange={onPick}
        options={[1, 2, 3, 4, 5].map((n) => ({
          value: n,
          ariaLabel: labels ? `${n} · ${labels[n - 1]}` : String(n),
          label: `${n}${value === n && labels && !small ? ` · ${labels[n - 1]}` : ''}`,
        }))}
      />
    </div>
  );
}

function NoteSheet({
  day,
  cur,
  s,
  onClose,
}: {
  day: number;
  cur: CheckIn | undefined;
  s: FunStrings;
  onClose: () => void;
}) {
  const [score, setScore] = useState<number>(cur?.score ?? 3);
  const [note, setNote] = useState(cur?.note ?? '');
  return (
    <FormSheet
      title={s.howFeel}
      s={s}
      onClose={onClose}
      onSave={() => {
        setCheck(day, { score, note: note.trim() });
        onClose();
      }}
    >
      <ScoreRow value={score} onPick={setScore} labels={s.scoreLabels} />
      <Textarea
        rows={3}
        maxLength={200}
        value={note}
        placeholder={s.notePlaceholder}
        onChange={(e) => setNote(e.target.value)}
      />
    </FormSheet>
  );
}

function CheckInWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { now, locale } = ctx;
  const s = fs(locale);
  const all = useLocal(checkStore);
  const [editing, setEditing] = useState(false);
  const today = dayOfTimestamp(now);
  const cur = all[today];
  const pick = (n: number) => setCheck(today, { score: n });
  const edit = () => setEditing(true);
  const sheet = editing ? (
    <NoteSheet day={today} cur={cur} s={s} onClose={() => setEditing(false)} />
  ) : null;
  const last7 = Array.from({ length: 7 }, (_, i) => today - 6 + i);
  const scores = last7.map((d) => all[d]?.score ?? 0);
  const got = scores.filter((x) => x > 0);
  const avg = got.length ? (got.reduce((a, b) => a + b, 0) / got.length).toFixed(1) : null;
  const label = cur ? s.scoreLabels[cur.score - 1] : '';
  const dayTxt = fmtWeekdayDayMonth(now, locale);
  let out: ReactNode;
  if (size === 'S')
    out = cur ? (
      <Widget
        size="S"
        tone="ok"
        kicker={s.howFeel}
        value={cur.score}
        unit={`/ 5 · ${label}`}
        sub={s.loggedAt(clock(cur.at))}
        onClick={edit}
      />
    ) : (
      <Widget
        size="S"
        tone="ok"
        kicker={s.checkIn}
        title={s.howFeel}
        sub={s.tapToLog}
        onClick={edit}
      />
    );
  else if (size === 'M')
    out = (
      <Widget
        size="M"
        tone="ok"
        icon="hand-heart"
        title={cur ? s.scoreOf(cur.score, label) : s.howFeel}
        sub={cur ? cur.note || s.loggedAt(clock(cur.at)) : s.tapToLog}
        onClick={edit}
        trailing={<ScoreRow value={cur?.score ?? null} onPick={pick} small />}
      />
    );
  else {
    const row = <ScoreRow value={cur?.score ?? null} onPick={pick} labels={s.scoreLabels} />;
    const note = cur?.note ? (
      <div className="uiw-t-md ut-text" style={{ ...muted }}>
        {cur.note}
      </div>
    ) : null;
    if (size === 'L')
      out = (
        <Widget
          size="L"
          tone="ok"
          kicker={s.checkInK(dayTxt)}
          badge={avg ? s.avg7(avg) : undefined}
          sub={cur?.note ? undefined : s.tapToLog}
          onClick={edit}
        >
          {row}
          {note}
        </Widget>
      );
    else {
      const lows = last7
        .map((d) => ({ d, c: all[d] }))
        .filter((x) => x.c && x.c.score <= 2 && x.c.note);
      const low = lows[lows.length - 1];
      out = (
        <Widget
          size="XL"
          tone="ok"
          kicker={s.checkInK(dayTxt)}
          badge={cur ? s.loggedAt(clock(cur.at)) : undefined}
          onClick={edit}
          footer={
            <Button variant="primary" size="sm" icon="pencil-simple" onClick={edit}>
              {cur?.note ? s.editNote : s.addNote}
            </Button>
          }
        >
          {row}
          {note}
          {avg && <span style={muted}>{s.avg7(avg)}</span>}
          <WidgetBars
            tone="ok"
            values={scores}
            highlight={[6]}
            height={60}
            labels={last7.map((d) => fmtWeekdayShort(timestampOfDay(d), locale).slice(0, 2))}
          />
          {low?.c && (
            <span style={muted}>
              {s.lowDay(fmtWeekdayShort(timestampOfDay(low.d), locale), low.c.note)}
            </span>
          )}
        </Widget>
      );
    }
  }
  return (
    <>
      {out}
      {sheet}
    </>
  );
}

const dailyCheckIn: WidgetDef = {
  id: 'daily-check-in',
  group: 'fun',
  icon: 'hand-heart',
  tone: 'ok',
  name: () => fs(getLocale()).checkIn,
  render: (size, ctx) => <CheckInWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Timer (stopwatch · EMOM · Tabata), survives reloads
 * ------------------------------------------------------------------------- */

type TimerMode = 'stopwatch' | 'emom' | 'tabata';
interface TimerState {
  mode: TimerMode;
  startedAt: number | null;
  accMs: number;
}

const timerStore = localStore<TimerState>('timer', { mode: 'emom', startedAt: null, accMs: 0 });
const EMOM_ROUNDS = 10;
const TABATA_ROUNDS = 8;

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function timerRead(mode: TimerMode, el: number, s: FunStrings) {
  if (mode === 'stopwatch')
    return {
      big: mmss(el),
      round: s.elapsed(mmss(el)),
      frac: (el % 60000) / 60000,
      done: false,
      total: null,
    };
  if (mode === 'emom') {
    const total = EMOM_ROUNDS * 60000;
    const done = el >= total;
    const round = Math.min(EMOM_ROUNDS, Math.floor(el / 60000) + 1);
    const left = done ? 0 : 60000 - (el % 60000);
    return {
      big: done ? s.finished : mmss(left),
      round: s.roundOf(round, EMOM_ROUNDS),
      frac: done ? 1 : 1 - left / 60000,
      done,
      total,
    };
  }
  const total = TABATA_ROUNDS * 30000;
  const done = el >= total;
  const round = Math.min(TABATA_ROUNDS, Math.floor(el / 30000) + 1);
  const inCycle = el % 30000;
  const work = inCycle < 20000;
  const left = done ? 0 : work ? 20000 - inCycle : 30000 - inCycle;
  return {
    big: done ? s.finished : mmss(left),
    round: `${s.roundOf(round, TABATA_ROUNDS)} · ${work ? s.work : s.restPhase}`,
    frac: done ? 1 : work ? inCycle / 20000 : (inCycle - 20000) / 10000,
    done,
    total,
  };
}

function TimerWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = fs(ctx.locale);
  const st = useLocal(timerStore);
  const [tick, setTick] = useState(ctx.now);
  const running = st.startedAt !== null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);
  const el = st.accMs + (st.startedAt !== null ? Math.max(0, tick - st.startedAt) : 0);
  const r = timerRead(st.mode, el, s);
  const modeName = st.mode === 'stopwatch' ? s.stopwatch : st.mode === 'emom' ? s.emom : s.tabata;
  const state =
    running && !r.done ? s.running : el > 0 && !r.done ? s.paused : r.done ? s.finished : s.ready;
  const toggle = () => {
    const t = Date.now();
    const cur = timerStore.read();
    if (cur.startedAt !== null)
      timerStore.write({ ...cur, startedAt: null, accMs: cur.accMs + (t - cur.startedAt) });
    else if (r.done) timerStore.write({ ...cur, startedAt: t, accMs: 0 });
    else timerStore.write({ ...cur, startedAt: t });
    setTick(t);
  };
  const reset = () => timerStore.write({ ...timerStore.read(), startedAt: null, accMs: 0 });
  const setMode = (m: TimerMode) => timerStore.write({ mode: m, startedAt: null, accMs: 0 });
  const kicker = `${modeName} · ${state}`;
  const playLabel = running && !r.done ? s.pause : s.resume;
  const playIcon = running && !r.done ? 'pause' : 'play';
  const controls = (
    <>
      <Button variant="primary" size="sm" icon={playIcon} onClick={toggle}>
        {playLabel}
      </Button>
      <Button variant="secondary" size="sm" icon="arrow-counter-clockwise" onClick={reset}>
        {s.reset}
      </Button>
    </>
  );
  const modes = (
    <div style={{ pointerEvents: 'auto' }}>
      <Segmented
        size="sm"
        value={st.mode}
        onChange={setMode}
        options={[
          { value: 'stopwatch', label: s.stopwatch, compact: true },
          { value: 'emom', label: s.emom },
          { value: 'tabata', label: s.tabata },
        ]}
      />
    </div>
  );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="accent"
        kicker={kicker}
        value={r.big}
        sub={r.round}
        onClick={toggle}
        ariaLabel={playLabel}
      />
    );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="timer"
        title={`${modeName} · ${r.big}`}
        sub={`${r.round} · ${state}`}
        onClick={toggle}
        ariaLabel={playLabel}
        trailing={
          <IconButton
            icon={playIcon}
            label={playLabel}
            size="sm"
            variant="secondary"
            onClick={toggle}
          />
        }
      />
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="accent" kicker={kicker} footer={controls}>
        <div className="ul-flex ua-center ug-14">
          <WidgetRing value={r.frac} size={64}>
            <span className="uiw-t-md">{r.big}</span>
          </WidgetRing>
          <div className="umw-0 uf-1 ul-flex ul-col ug-6">
            {modes}
            <span style={muted}>{r.round}</span>
          </div>
        </div>
      </Widget>
    );
  const desc =
    st.mode === 'stopwatch' ? s.stopwatchDesc : st.mode === 'emom' ? s.emomDesc : s.tabataDesc;
  return (
    <Widget size="XL" tone="accent" kicker={kicker} footer={controls}>
      {modes}
      <div className="ul-grid uf-1" style={{ placeItems: 'center' }}>
        <WidgetRing value={r.frac} size={150}>
          <span className="uiw-t-hero">{r.big}</span>
          <small>
            {st.mode === 'emom' ? s.leftInMinute : st.mode === 'tabata' ? s.leftInPhase : ''}
          </small>
        </WidgetRing>
      </div>
      <div className="uiw-t-lg utx-center">{r.round}</div>
      <div className="utx-center" style={{ ...muted }}>
        {desc}
        {r.total ? ` · ${s.elapsedOf(mmss(Math.min(el, r.total)), mmss(r.total))}` : ''}
      </div>
    </Widget>
  );
}

const timer: WidgetDef = {
  id: 'timer',
  group: 'fun',
  icon: 'timer',
  tone: 'accent',
  name: () => fs(getLocale()).timer,
  render: (size, ctx) => <TimerWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Sync status
 * ------------------------------------------------------------------------- */

const syncStatus: WidgetDef = {
  id: 'sync-status',
  group: 'fun',
  icon: 'arrows-clockwise',
  tone: 'neutral',
  name: () => fs(getLocale()).syncStatus,
  render: (size, { store, now, locale, shell, t }) => {
    const s = fs(locale);
    const st = store.syncStatus;
    const tone: Tone =
      st === 'offline'
        ? 'illness'
        : st === 'failed'
          ? 'danger'
          : st === 'synced'
            ? 'ok'
            : 'neutral';
    const icon = st === 'offline' || st === 'failed' ? 'cloud-slash' : 'arrows-clockwise';
    const title =
      st === 'offline'
        ? s.offline
        : st === 'failed'
          ? s.syncFailed
          : st === 'synced'
            ? s.allSaved
            : s.syncing;
    const last = store.lastSyncAt ? s.lastSync(clock(store.lastSyncAt)) : s.neverSynced;
    const bad = st === 'offline' || st === 'failed';
    const retry = () => retrySync();
    const open = () => shell.openOverlay({ screen: 'settings' });
    const note = bad ? s.savedOnPhone : s.syncedCloud;
    const retryBtn = (
      <Button variant="secondary" size="sm" icon="arrows-clockwise" onClick={retry}>
        {s.retry}
      </Button>
    );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone={tone}
          kicker={title}
          title={last}
          sub={note}
          onClick={open}
          footer={bad ? retryBtn : undefined}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone={tone}
          icon={icon}
          title={title}
          sub={last}
          onClick={open}
          trailing={bad ? retryBtn : undefined}
        />
      );
    // The latest things this phone logged — what a sync carries.
    const recent: { label: string; value: string; at: number }[] = [
      ...finished(store).map((w) => {
        // The day's name, else the first lift ("Bench press"); unnamed ones are skipped.
        const first = w.exercises[0]?.name ?? '';
        return {
          label:
            w.dayName?.trim() || (first ? (localizedExerciseName(first, locale) ?? first) : ''),
          value: clock(w.finishedAt ?? w.startedAt),
          at: w.finishedAt ?? w.startedAt,
        };
      }),
      ...store.activities
        .filter((a) => a.finishedAt !== null)
        .map((a) => ({
          label: t.actType[a.type] ?? a.type,
          value: clock(a.startedAt),
          at: a.startedAt,
        })),
      ...(store.bodyMetrics.weights ?? []).map((w) => ({
        label: s.weighIn(fmtBodyWeightKg(w.weight)),
        value: clock(w.at),
        at: w.at,
      })),
    ]
      .filter((x) => x.at <= now && x.label.trim() !== '')
      .sort((a, b) => b.at - a.at)
      .slice(0, 3)
      .map((x) => ({
        ...x,
        value: dayOfTimestamp(x.at) === dayOfTimestamp(now) ? x.value : fmtDayMonth(x.at, locale),
      }));
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone={tone}
          kicker={title}
          badge={last}
          onClick={open}
          footer={bad ? retryBtn : undefined}
        >
          <WidgetList
            rows={recent.slice(0, bad ? 1 : 2).map(({ label, value }) => ({ label, value }))}
          />
          <span style={muted}>{note}</span>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone={tone}
        kicker={title}
        title={title}
        sub={`${last}${store.syncError ? ` · ${store.syncError.statusLine}` : ''}`}
        bodyLast
        onClick={open}
        footer={
          <>
            {bad && (
              <Button variant="primary" size="sm" icon="arrows-clockwise" onClick={retry}>
                {s.retryNow}
              </Button>
            )}
            <Button variant="secondary" size="sm" icon="gear" onClick={open}>
              {s.backupSettings}
            </Button>
          </>
        }
      >
        <div className="ul-flex ua-center ug-12">
          <IconTile tone={tone} size={48} icon={icon} />
          <span style={muted}>{note}</span>
        </div>
        {recent.length > 0 && (
          <>
            <span className="uiw-kicker ut-muted">{s.latestOnPhone}</span>
            <WidgetList rows={recent.map(({ label, value }) => ({ label, value }))} />
          </>
        )}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------------------
 * Notifications (the derived milestone inbox)
 * ------------------------------------------------------------------------- */

function notifApp(n: Notif, s: FunStrings): { label: string; tone: Tone } {
  if (n.kind === 'streak' || n.kind === 'challenge') return { label: s.appApex, tone: 'apex' };
  if (n.kind === 'atlas') return { label: s.appAtlas, tone: 'atlas' };
  return { label: s.appGym, tone: 'accent' };
}

function NotificationsWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { now, t, locale, shell } = ctx;
  const s = fs(locale);
  const { notifs, state } = useNotifs();
  const unread = notifs.filter((n) => !isSeen(state, n.id));
  const count = unreadCount(state, notifs);
  const open = () => shell.openOverlay({ screen: 'notifications' });
  if (notifs.length === 0 || (count === 0 && size !== 'XL' && size !== 'L'))
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon={size === 'M' ? 'bell' : 'check-circle'}
        kicker={s.inbox}
        title={s.allCaughtUp}
        sub={size === 'M' ? s.inbox : undefined}
        onAction={open}
      />
    );
  const lead = (unread[0] ?? notifs[0]).title;
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="accent"
        kicker={s.inbox}
        value={count}
        unit={s.unread}
        sub={lead}
        onClick={open}
      />
    );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="bell"
        title={s.unreadN(count)}
        sub={unread
          .slice(0, 3)
          .map((n) => n.title)
          .join(' · ')}
        onClick={open}
      />
    );
  const list = (unread.length ? unread : notifs).slice(0, size === 'L' ? 3 : 5);
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="accent"
        kicker={s.notificationsK}
        badge={s.unreadN(count)}
        onClick={open}
      >
        <WidgetList rows={list.map((n) => ({ label: n.title, value: notifApp(n, s).label }))} />
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="accent"
      kicker={s.notificationsK}
      badge={s.unreadN(count)}
      onClick={open}
      footer={
        <>
          <Button variant="primary" size="sm" iconTrailing="caret-right" onClick={open}>
            {s.openInbox}
          </Button>
          {count > 0 && (
            <Button variant="ghost" size="sm" icon="check" onClick={markAllNotifsSeen}>
              {s.markAllRead}
            </Button>
          )}
        </>
      }
    >
      <WidgetList
        rows={list.map((n) => {
          const app = notifApp(n, s);
          return {
            icon: n.kind === 'pr' ? 'trophy' : n.kind === 'streak' ? 'flame' : 'bell',
            tone: app.tone,
            label: n.title,
            value: `${app.label} · ${notifTime(n.ts, now, t, locale)}`,
          };
        })}
      />
    </Widget>
  );
}

const notifications: WidgetDef = {
  id: 'notifications',
  group: 'fun',
  icon: 'bell',
  tone: 'accent',
  name: () => fs(getLocale()).notifications,
  render: (size, ctx) => <NotificationsWidget size={size} ctx={ctx} />,
};

/* ---------------------------------------------------------------------------
 * Beat last week (volume race to the same point of the week)
 * ------------------------------------------------------------------------- */

/** Two cumulative lines: this week (solid) vs last week (dashed). */
function RaceChart({
  cur,
  prev,
  labels,
  height,
}: {
  cur: number[];
  prev: number[];
  labels: string[];
  height: number;
}) {
  const W = 300;
  const max = Math.max(1, ...cur, ...prev);
  const path = (v: number[]) =>
    v
      .map(
        (x, i) =>
          `${i ? 'L' : 'M'}${((i / 6) * W).toFixed(1)} ${(height - 4 - (x / max) * (height - 8)).toFixed(1)}`,
      )
      .join(' ');
  return (
    <div className="ul-flex ul-col ug-4">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={path(prev)}
          fill="none"
          stroke="var(--color-neutral-600)"
          strokeWidth={2}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        {cur.length > 1 && (
          <path
            d={path(cur)}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="uiw-t-xs ut-muted ul-flex uj-between">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}

const beatLastWeek: WidgetDef = {
  id: 'beat-last-week',
  group: 'fun',
  icon: 'trend-up',
  tone: 'accent',
  name: () => fs(getLocale()).beatLastWeek,
  render: (size, { store, now, locale, shell }) => {
    const s = fs(locale);
    const ws = weekStartOf(now);
    const prevWs = weekStartOf(ws - 1);
    const offset = now - ws;
    const done = finished(store);
    const thisList = done
      .filter((w) => w.startedAt >= ws && w.startedAt <= now)
      .sort((a, b) => a.startedAt - b.startedAt);
    const prevList = done.filter((w) => w.startedAt >= prevWs && w.startedAt < ws);
    const vol = (l: Workout[]) => l.reduce((a, w) => a + workoutVolumeKg(w), 0);
    const cur = vol(thisList);
    const lastBy = vol(prevList.filter((w) => w.startedAt - prevWs <= offset));
    const lastTotal = vol(prevList);
    const open = () => shell.goTab('progress');
    if (cur === 0 && lastTotal === 0)
      return (
        <Invite
          size={size}
          tone="accent"
          icon="trend-up"
          kicker={s.beatLastWeek}
          title={s.raceEmpty}
          action={s.startSession}
          onAction={shell.openStart}
        />
      );
    const diff = cur - lastBy;
    const good = diff >= 0;
    const d = tons(Math.abs(diff));
    const signedT = `${good ? '+' : '−'}${d}`;
    const today = fmtWeekdayShort(now, locale);
    const vs = s.xVsYBy(tons(cur), tons(lastBy), today);
    const toPassKg = lastTotal - cur;
    const passLine =
      toPassKg > 0 ? s.toPass(tons(toPassKg), tons(lastTotal)) : s.passed(tons(lastTotal));
    if (size === 'S')
      return (
        // Behind: tonnes still to lift to match last week by today; ahead: the lead.
        <Widget
          size="S"
          tone="accent"
          kicker={good ? s.aheadK : s.toMatchK}
          value={good ? <WidgetDelta good>{`+${d}`}</WidgetDelta> : d}
          unit={s.tUnit}
          sub={s.soFarBy(tons(cur), tons(lastBy), today)}
          onClick={open}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="trend-up"
          title={good ? s.aheadOf(d) : s.behind(d)}
          sub={vs}
          onClick={open}
        />
      );
    const badge = (
      <WidgetDelta good={good}>{good ? s.aheadShort(d) : s.behindShort(d)}</WidgetDelta>
    );
    if (size === 'L') {
      const max = Math.max(cur, lastBy, 1);
      const row = (label: string, v: number, tone: Tone) => (
        <div className="ul-flex ul-col ug-4">
          <div className="uiw-t-base ul-flex uj-between">
            <span className="ut-muted">{label}</span>
            <span className="ut-w6">{tons(v)} t</span>
          </div>
          <WidgetBar value={v / max} tone={tone} />
        </div>
      );
      return (
        <Widget size="L" tone="accent" kicker={s.beatLastWeek} badge={badge} onClick={open}>
          {row(s.thisWeekRow, cur, 'accent')}
          {row(s.lastWeekBy(today), lastBy, 'neutral')}
          <span style={muted}>{passLine}</span>
        </Widget>
      );
    }
    // Cumulative per day: this week up to today, last week all seven days.
    const dayIdx = (ts: number, base: number) => dayOfTimestamp(ts) - dayOfTimestamp(base);
    const cum = (l: Workout[], base: number, days: number) => {
      const out = Array.from({ length: days }, () => 0);
      for (const w of l) {
        const i = dayIdx(w.startedAt, base);
        if (i >= 0 && i < 7) for (let k = i; k < days; k++) out[k] += workoutVolumeKg(w);
      }
      return out;
    };
    const todayIdx = Math.min(6, dayIdx(now, ws));
    const labels = Array.from({ length: 7 }, (_, i) =>
      fmtWeekdayShort(ws + i * DAY + DAY / 2, locale).slice(0, 2),
    );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.beatLastWeek}
        badge={s.weekVs(isoWeek(now), isoWeek(prevWs + DAY / 2))}
        value={<WidgetDelta good={good}>{`${signedT} t`}</WidgetDelta>}
        sub={vs}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" iconTrailing="caret-right" onClick={open}>
            {s.weeklyVolume}
          </Button>
        }
      >
        <RaceChart
          cur={cum(thisList, ws, todayIdx + 1)}
          prev={cum(prevList, prevWs, 7)}
          labels={labels}
          height={80}
        />
        <WidgetList
          rows={thisList
            .slice(-3)
            .reverse()
            .map((w) => ({
              label: [
                w.dayName?.trim() ||
                  (w.exercises[0]
                    ? (localizedExerciseName(w.exercises[0].name, locale) ?? w.exercises[0].name)
                    : ''),
                fmtWeekdayShort(w.startedAt, locale),
              ]
                .filter(Boolean)
                .join(' · '),
              value: `${tons(workoutVolumeKg(w))} t`,
            }))}
        />
        <span style={muted}>{passLine}</span>
      </Widget>
    );
  },
};

export const FUN_WIDGETS: WidgetDef[] = [
  wildcard,
  milestones,
  shareCard,
  eventCountdown,
  progressPhotos,
  motto,
  dailyCheckIn,
  timer,
  syncStatus,
  notifications,
  beatLastWeek,
];

/** Locale helper for pickers outside React (kept for parity with other groups). */
export function funStrings(locale: LocaleId = getLocale()): FunStrings {
  return fs(locale);
}
