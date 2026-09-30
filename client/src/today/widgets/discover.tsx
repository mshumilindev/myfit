/**
 * Discover & daily widgets (design L4-Discover): things that change every day
 * or surface something new. "Of the day" picks are seeded by the LOCAL date, so
 * a pick stays put all day and every size shows the same one.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetList,
  WidgetRing,
  WidgetSpark,
  WidgetStats,
  type WidgetSize,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { IconTile } from '../../components/ui/IconTile';
import type { Tone } from '../../components/ui/tones';
import { MoonGlyph } from '../../components/MoonGlyph';
import { fmtDayMonth, fmtWeekdayShort, getLocale, type LocaleId } from '../../i18n';
import type { Strings } from '../../i18n/en';
import {
  BUILT_IN_CATALOG,
  muscleInfoByName,
  richExerciseById,
  type MuscleGroup,
  type RichExercise,
} from '../../data/exercises';
import { localizedExerciseName } from '../../data/exerciseNames';
import { equipmentById, type EquipmentItem } from '../../data/equipmentCatalog';
import { localizedEquipInfo, localizedEquipName } from '../../data/equipmentI18n';
import { programDayHasPlan, programDayItems, readProgramCache } from '../../data/programMine';
import { dayReadoutLabel } from '../../data/daySuggest';
import { techFor } from '../../atlas/technique';
import {
  activeRestPeriod,
  addExercise,
  dayKey,
  equipmentFor,
  isStrengthExercise,
  liveSleep,
  pickSessionGym,
  programDayNameFor,
  setBestE1rm,
  startWorkout,
  workoutDayReadout,
  workoutVolumeKg,
} from '../../store';
import type { Gym, Workout } from '../../types';
import { rankExercisesForMuscle } from '../../sessionBuilder';
import { illumPct, moonInfo } from '../../moon';
import { resolvePlan, usualPlan } from '../../sleep';
import {
  activeTemplateIds,
  challengeCatalog,
  challengeCtx,
  challengeProgress,
  fmtChallengeDuration,
  fmtChallengeValue,
  isReach,
  startChallenge,
  useChallenges,
  type ChallengeTemplate,
} from '../../challenges';
import { muscleReadiness } from '../../recovery';
import { activityType, durationMin } from '../../activities';
import type { WidgetCtx, WidgetDef } from '../registry';
import { ds, type DiscoverStrings } from './discover.strings';
import { DAY, hm, pct, signed } from './format';

/* ---------------------------------------------------------------- helpers */

/** Local calendar day "2026-9-28" — the seed of every daily pick. */
function localDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** FNV-1a — a stable small hash for seeding. */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The item of the day (same all day, per widget `salt`); `offset` = skips. */
function dailyPick<T>(list: T[], now: number, salt: string, offset = 0): T | undefined {
  if (list.length === 0) return undefined;
  return list[(seedOf(`${localDateKey(now)}|${salt}`) + offset) % list.length];
}

function readLocal<T>(id: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`spotter.tw.${id}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(id: string, v: unknown): void {
  try {
    localStorage.setItem(`spotter.tw.${id}`, JSON.stringify(v));
  } catch {
    /* private mode — the skip simply doesn't survive a reload */
  }
}

/** "Skip / Another" for a daily pick: how many times it was skipped TODAY. */
function useDailyOffset(id: string, now: number): [number, () => void] {
  const day = localDateKey(now);
  const [st, setSt] = useState(() => readLocal<{ day: string; n: number }>(id, { day, n: 0 }));
  const n = st.day === day ? st.n : 0;
  const bump = () => {
    const next = { day, n: n + 1 };
    setSt(next);
    writeLocal(id, next);
  };
  return [n, bump];
}

const exName = (name: string, locale: LocaleId) => localizedExerciseName(name, locale) ?? name;
const muscleName = (t: Strings, m: MuscleGroup | string) => t.muscleGroups[m] ?? String(m);

function finishedOf(ctx: WidgetCtx): Workout[] {
  return ctx.store.workouts.filter((w) => w.finishedAt !== null);
}

function sessionLabel(w: Workout, all: Workout[], t: Strings): string {
  const named = programDayNameFor(w, all);
  if (named) return named;
  const r = workoutDayReadout(w);
  return r ? dayReadoutLabel(r, t) : t.defaultTimedExerciseNames.strength;
}

/** Thin-space thousands: 1284 → "1 284". */
function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const LOCALE_TAG: Record<LocaleId, string> = {
  en: 'en-GB',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};

/** Wrapping body text (the kit's sub line is single-line by default). */
function Para({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'uiw-name' : 'uiw-sub'} style={{ whiteSpace: 'normal' }}>
      {children}
    </div>
  );
}

/** A photo in a widget body (layout-only box; radius from tokens). */
function Photo({ src, h, w }: { src: string; h: number | string; w?: number | string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="ur-lg uf-none ul-block"
      style={{ width: w ?? '100%', height: h, objectFit: 'cover' }}
    />
  );
}

/** Empty / info state in any size — the kit's WidgetEmpty. */
function Empty({
  size,
  tone,
  icon,
  kicker,
  title,
  sub,
  onClick,
  action,
}: {
  size: WidgetSize;
  tone: Tone;
  icon: string;
  kicker: string;
  title: string;
  sub?: string;
  onClick?: () => void;
  action?: { label: string; run: () => void };
}) {
  return (
    <WidgetEmpty
      size={size}
      tone={tone}
      icon={icon}
      kicker={kicker}
      title={title}
      sub={sub}
      action={action?.label}
      actionIcon="caret-right"
      onAction={action?.run ?? onClick}
    />
  );
}

/** Start (or extend) today's session with one exercise. */
function addToToday(ctx: WidgetCtx, name: string, label: string): void {
  const { store, shell } = ctx;
  const open = store.workouts.find((w) => w.finishedAt === null);
  if (open) {
    addExercise(open.id, name, 'strength');
    shell.toast({ kind: 'ok', icon: 'check-circle', text: label });
    shell.openOverlay({ screen: 'session', workoutId: open.id });
    return;
  }
  const w = startWorkout(pickSessionGym()?.id ?? null);
  if (!w) {
    shell.openStart();
    return;
  }
  addExercise(w.id, name, 'strength');
  shell.openOverlay({ screen: 'session', workoutId: w.id });
}

/* ------------------------------------------------------ exercise of the day */

let EOD_CACHE: { key: string; ids: string[] } | null = null;

/** Catalog lifts with a photo, available at the gym, preferably never done. */
function exercisePool(workouts: Workout[], gym: Gym | null): string[] {
  const done = new Set<string>();
  for (const w of workouts) for (const e of w.exercises) done.add(e.name.trim().toLowerCase());
  const inv = gym?.inventory ?? [];
  const key = `${gym?.id ?? '-'}|${inv.join(',')}|${done.size}`;
  if (EOD_CACHE?.key === key) return EOD_CACHE.ids;
  const all: { id: string; name: string }[] = [];
  for (const ex of BUILT_IN_CATALOG) {
    const r = richExerciseById(ex.id);
    if (!r || r.category !== 'strength' || r.images.length === 0) continue;
    if (r.level === 'expert' || ex.muscle === 'cardio') continue;
    if (inv.length > 0 && r.equipment && !inv.includes(r.equipment)) continue;
    all.push({ id: r.id, name: r.name });
  }
  const fresh = all.filter((x) => !done.has(x.name.trim().toLowerCase()));
  const ids = (fresh.length > 0 ? fresh : all).map((x) => x.id);
  EOD_CACHE = { key, ids };
  return ids;
}

function ExerciseOfDay({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale, shell } = ctx;
  const s = ds(locale);
  const [offset, skip] = useDailyOffset('exercise-of-the-day', now);
  const gym = useMemo(() => pickSessionGym(), [store.gyms]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = useMemo(() => exercisePool(store.workouts, gym), [store.workouts, gym]);
  const id = dailyPick(pool, now, 'exercise', offset);
  const rich: RichExercise | null = id ? richExerciseById(id) : null;
  if (!rich)
    return (
      <Empty
        size={size}
        tone="accent"
        icon="barbell"
        kicker={s.daily}
        title={s.names.exercise}
        onClick={() => shell.openOverlay({ screen: 'library' })}
      />
    );
  const disp = exName(rich.name, locale);
  const muscles = [...rich.primaryMuscles, ...rich.secondaryMuscles]
    .filter((m, i, a) => a.indexOf(m) === i)
    .slice(0, 3)
    .map((m) => muscleName(t, m));
  const img = rich.images[0];
  const open = () => shell.openOverlay({ screen: 'exercise-detail', name: rich.name });
  const add = () => addToToday(ctx, rich.name, s.added(disp));
  const tech = locale === 'en' || locale === 'uk' ? techFor(rich.name) : null;
  const cue = tech
    ? tech.cues[locale === 'uk' ? 1 : 0]
    : [rich.mechanic ? s.mech[rich.mechanic] : null, rich.level ? s.level[rich.level] : null]
        .filter(Boolean)
        .join(' · ');

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="barbell"
        title={disp}
        sub={`${s.names.exercise} · ${muscles[0] ?? ''}`}
        onClick={open}
        trailing={
          <Button variant="secondary" size="sm" icon="plus" aria-label={s.addToday} onClick={add} />
        }
      />
    );
  if (size === 'S')
    return (
      <Widget size="S" tone="accent" kicker={s.daily} title={disp} onClick={open}>
        <Photo src={img} h={56} />
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="accent" kicker={s.names.exercise} onClick={open}>
        <div className="ul-flex ug-14 uf-1" style={{ minHeight: 0 }}>
          <Photo src={img} h="100%" w={110} />
          <div className="ul-flex ul-col ug-4 uf-1 umw-0">
            <div className="uiw-name">{disp}</div>
            <div className="uiw-sub">{muscles.join(' · ')}</div>
            <div className="ul-flex ug-6 umt-auto">
              <Button variant="primary" size="sm" onClick={add}>
                {s.plusToday}
              </Button>
              <Button variant="ghost" size="sm" onClick={open}>
                {s.why}
              </Button>
            </div>
          </div>
        </div>
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="accent"
      kicker={s.names.exercise}
      badge={fmtDayMonth(now, locale)}
      onClick={open}
      footer={
        <>
          <div className="uf-1 ul-flex">
            <Button variant="primary" size="sm" fullWidth onClick={add}>
              {s.addToday}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={skip}>
            {s.skip}
          </Button>
        </>
      }
    >
      <Photo src={img} h={120} />
      <div className="uiw-name">{disp}</div>
      <div className="ul-flex ug-6 ul-wrap">
        {muscles.map((m) => (
          <Chip key={m} size="sm">
            {m}
          </Chip>
        ))}
      </div>
      {cue ? <Para>{cue}</Para> : <Para>{s.newForYou}</Para>}
    </Widget>
  );
}

/* ----------------------------------------------------------- tip of the day */

type TipKey = keyof DiscoverStrings['tips'];

/** Which tip fits a lift name (ordered: specific before general). */
const TIP_MATCH: [TipKey, (n: string) => boolean][] = [
  ['rdl', (n) => /romanian|stiff[- ]?leg/.test(n)],
  ['lunge', (n) => /lunge|split squat/.test(n)],
  ['hipthrust', (n) => /hip thrust|glute bridge/.test(n)],
  ['deadlift', (n) => /deadlift/.test(n)],
  ['squat', (n) => /squat/.test(n)],
  ['ohp', (n) => /overhead press|military press|shoulder press|push press/.test(n)],
  ['bench', (n) => /bench press|chest press|floor press/.test(n)],
  ['dip', (n) => /\bdips?\b/.test(n)],
  ['pullup', (n) => /pull-?ups?|chin-?ups?|pulldown/.test(n)],
  ['row', (n) => /\brows?\b|rowing/.test(n) && !/upright/.test(n)],
  ['curl', (n) => /curl/.test(n) && !/leg curl|hamstring curl/.test(n)],
];

/** Lifts on today's menu: the program day if any, else the recent sessions. */
function todaysLifts(ctx: WidgetCtx): string[] {
  const a = readProgramCache();
  const wd = ((new Date(ctx.now).getDay() + 6) % 7) + 1;
  if (a && programDayHasPlan(a, wd)) {
    const items = programDayItems(a, wd).filter((i) => i.kind === 'strength');
    if (items.length > 0) return items.map((i) => i.name);
  }
  const out: string[] = [];
  for (const w of finishedOf(ctx).slice(0, 3))
    for (const e of w.exercises) if (isStrengthExercise(e)) out.push(e.name);
  return out;
}

function tipOfDay(ctx: WidgetCtx): { key: TipKey; lift: string | null } {
  const hits: { key: TipKey; lift: string }[] = [];
  for (const name of todaysLifts(ctx)) {
    const low = name.toLowerCase();
    const m = TIP_MATCH.find(([, f]) => f(low));
    if (m && !hits.some((h) => h.key === m[0])) hits.push({ key: m[0], lift: name });
  }
  const pick = dailyPick(hits, ctx.now, 'tip');
  if (pick) return pick;
  const keys = Object.keys(ds('en').tips) as TipKey[];
  return { key: dailyPick(keys, ctx.now, 'tip-any') ?? 'brace', lift: null };
}

const tip: WidgetDef = {
  id: 'tip-of-the-day',
  group: 'discover',
  icon: 'graduation-cap',
  tone: 'neutral',
  name: () => ds(getLocale()).names.tip,
  render: (size, ctx) => {
    const { locale, shell } = ctx;
    const s = ds(locale);
    const { key, lift } = tipOfDay(ctx);
    const tp = s.tips[key];
    const forLift = lift ? exName(lift, locale) : tp.lift;
    const open = () =>
      lift
        ? shell.openOverlay({ screen: 'exercise-detail', name: lift })
        : shell.openOverlay({ screen: 'library' });
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="graduation-cap"
          title={tp.short}
          sub={s.tipFor(forLift)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget size="S" tone="neutral" kicker={s.tipKicker} onClick={open}>
          <div className="umt-auto">
            <Para strong>{tp.short}</Para>
            <div className="uiw-sub">{forLift}</div>
          </div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="neutral" kicker={s.tipForKicker(forLift)} onClick={open}>
          <Para strong>{tp.text}</Para>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.names.tip}
        badge={forLift}
        onClick={open}
        footer={
          <Button variant="secondary" size="sm" fullWidth onClick={open}>
            {s.seeTechnique}
          </Button>
        }
      >
        <Para strong>{tp.text}</Para>
        <div className="ul-flex ug-12 ua-center">
          <IconTile tone="ok" icon="info" size={36} />
          <Para>{tp.why}</Para>
        </div>
        <WidgetList
          rows={tp.checks.map((c) => ({ label: c, icon: 'check', tone: 'ok' as Tone }))}
        />
      </Widget>
    );
  },
};

/* ------------------------------------------------------------ kit spotlight */

const KIT_CATS = new Set([
  'machine',
  'plateLoaded',
  'cable',
  'barbell',
  'dumbbell',
  'kettlebell',
  'suspension',
  'band',
  'conditioning',
  'bench',
]);
const MOVES_CACHE = new Map<string, string[]>();
const PRESCRIPTION = ['3 × 10', '3 × 12', '3 × 15'];

/** Up to three catalog lifts done on this kind of kit. Items tagged by their
 *  target muscles rank per muscle; generic "full body" kit (bars, benches…)
 *  falls back to the best lift of each muscle done with its tool class. */
function movesFor(item: EquipmentItem): string[] {
  const hit = MOVES_CACHE.get(item.id);
  if (hit) return hit;
  const out: string[] = [];
  const take = (muscles: MuscleGroup[], perMuscle: number) => {
    for (const m of muscles) {
      let n = 0;
      for (const c of rankExercisesForMuscle(m, null)) {
        if (c.equipment !== item.cls || out.includes(c.name)) continue;
        out.push(c.name);
        n += 1;
        if (out.length >= 3 || n >= perMuscle) break;
      }
      if (out.length >= 3) break;
    }
  };
  take(item.muscles, 3);
  if (out.length < 3) take(ALL_MUSCLES, 1);
  MOVES_CACHE.set(item.id, out);
  return out;
}

const ALL_MUSCLES: MuscleGroup[] = [...new Set(BUILT_IN_CATALOG.map((e) => e.muscle))];

/** Kit the user has effectively used: items picked on a set, plus any item of a
 *  tool class they trained with whose muscles match the lift (a squat with a
 *  barbell counts for every full-body bar; a chest press does not count for the
 *  leg press). Looks at every finished workout, not only this gym. */
function usedKit(store: WidgetCtx['store'], items: EquipmentItem[]): Set<string> {
  const used = new Set<string>();
  const byCls = new Map<string, Set<string>>(); // class → primary muscles trained with it
  for (const w of store.workouts) {
    if (w.finishedAt === null) continue;
    for (const e of w.exercises) {
      for (const id of e.equipmentItems ?? []) used.add(id);
      const info = muscleInfoByName(e.name);
      for (const cls of equipmentFor(e)) {
        const set = byCls.get(cls) ?? new Set<string>();
        if (info?.primary) set.add(info.primary);
        byCls.set(cls, set);
      }
    }
  }
  for (const it of items) {
    const ms = byCls.get(it.cls);
    if (!ms) continue;
    if (
      it.muscles.length === 0 ||
      it.muscles.includes('fullbody' as MuscleGroup) ||
      it.muscles.some((m) => ms.has(m))
    )
      used.add(it.id);
  }
  return used;
}

const kit: WidgetDef = {
  id: 'kit-spotlight',
  group: 'discover',
  icon: 'toolbox',
  tone: 'neutral',
  name: () => ds(getLocale()).names.kit,
  render: (size, ctx) => {
    const { store, now, locale, shell } = ctx;
    const s = ds(locale);
    const gym = pickSessionGym();
    if (!gym)
      return (
        <Empty
          size={size}
          tone="neutral"
          icon="toolbox"
          kicker={s.names.kit}
          title={s.noGym}
          sub={s.noGymSub}
          onClick={() => shell.goTab('gyms')}
        />
      );
    const openGym = () => shell.openOverlay({ screen: 'gym', gymId: gym.id });
    const shared = gym.externalId ? store.sharedGyms[gym.externalId]?.equipmentItems : undefined;
    const items = shared ?? gym.equipmentItems ?? [];
    if (items.length === 0)
      return (
        <Empty
          size={size}
          tone="neutral"
          icon="toolbox"
          kicker={s.kitKicker(gym.name)}
          title={s.noKit}
          sub={s.noKitSub}
          onClick={openGym}
          action={{ label: s.openGym, run: openGym }}
        />
      );
    const gymItems = items
      .map((id) => equipmentById(id))
      .filter((it): it is EquipmentItem => !!it && KIT_CATS.has(it.category));
    const used = usedKit(store, gymItems);
    // Only kit the user has never touched AND that has real moves to suggest.
    const cands = gymItems.filter(
      (it) => it.muscles.length > 0 && !used.has(it.id) && movesFor(it).length > 0,
    );
    const item = dailyPick(cands, now, `kit|${gym.id}`);
    if (!item)
      return (
        <Empty
          size={size}
          tone="ok"
          icon="check-circle"
          kicker={s.kitKicker(gym.name)}
          title={s.allUsed}
          sub={s.allUsedSub(gymItems.filter((it) => used.has(it.id)).length)}
          onClick={openGym}
        />
      );
    const name = localizedEquipName(item, locale);
    const moves = movesFor(item);
    const img = item.image?.thumbUrl;
    const open = () => shell.openOverlay({ screen: 'equipment', itemId: item.id, gymId: gym.id });
    const pic = (h: number | string, w?: number) =>
      img ? <Photo src={img} h={h} w={w} /> : <IconTile tone="neutral" icon="toolbox" size={40} />;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="toolbox"
          title={s.titleNeverUsed(name)}
          sub={s.kitAt(gym.name)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={gym.name}
          title={name}
          sub={s.neverUsedMoves(moves.length)}
          onClick={open}
        >
          {pic(50)}
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="neutral" kicker={s.kitKicker(gym.name)} onClick={open}>
          <div className="ul-flex ug-14 uf-1" style={{ minHeight: 0 }}>
            {pic('100%', 110)}
            <div className="ul-flex ul-col ug-4 uf-1 umw-0">
              <div className="uiw-name">{name}</div>
              <div className="uiw-sub">{localizedEquipInfo(item, locale) ?? s.kitBlurb}</div>
              <div className="umt-auto">
                <Button variant="primary" size="sm" onClick={open}>
                  {s.seeMoves(moves.length)}
                </Button>
              </div>
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.kitKicker(gym.name)}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.seeMoves(moves.length)}
          </Button>
        }
      >
        {pic(110)}
        <div className="uiw-name">{name}</div>
        {moves.length > 0 ? (
          <WidgetList
            rows={moves.map((m, i) => ({ label: exName(m, locale), value: PRESCRIPTION[i] }))}
          />
        ) : (
          <Para>{s.kitBlurb}</Para>
        )}
      </Widget>
    );
  },
};

/* -------------------------------------------------------------- on this day */

function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

function topLift(w: Workout): { name: string; e1: number } | null {
  let best: { name: string; e1: number } | null = null;
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    const e1 = Math.max(0, ...e.sets.map(setBestE1rm));
    if (e1 > 0 && (!best || e1 > best.e1)) best = { name: e.name, e1 };
  }
  return best;
}

function liftE1In(w: Workout, name: string): number {
  const low = name.trim().toLowerCase();
  let m = 0;
  for (const e of w.exercises)
    if (e.name.trim().toLowerCase() === low)
      for (const s of e.sets) m = Math.max(m, setBestE1rm(s));
  return m;
}

const onThisDay: WidgetDef = {
  id: 'on-this-day',
  group: 'discover',
  icon: 'clock-counter-clockwise',
  tone: 'apex',
  name: () => ds(getLocale()).names.onThisDay,
  render: (size, ctx) => {
    const { now, t, locale, shell } = ctx;
    const s = ds(locale);
    const finished = finishedOf(ctx);
    const today = dayKey(now);
    const anchors = [
      { label: s.agoYear, ts: addMonths(now, -12) },
      { label: s.agoHalf, ts: addMonths(now, -6) },
      { label: s.agoMonth, ts: addMonths(now, -1) },
    ];
    const hits = anchors
      .map((a) => {
        const k = dayKey(a.ts);
        let best: Workout | null = null;
        for (const w of finished) {
          const d = Math.abs(dayKey(w.startedAt) - k);
          if (d <= 2 && (!best || d < Math.abs(dayKey(best.startedAt) - k))) best = w;
        }
        return best ? { ...a, w: best } : null;
      })
      .filter((x): x is { label: string; ts: number; w: Workout } => !!x);
    const head = hits[0];
    if (!head) {
      const first = finished[finished.length - 1];
      const young = first && today - dayKey(first.startedAt) < 28;
      return (
        <Empty
          size={size}
          tone="apex"
          icon="clock-counter-clockwise"
          kicker={s.names.onThisDay}
          title={first && !young ? s.nothingThisDay : s.noFlashback}
          sub={
            first && young
              ? s.flashbackOn(fmtDayMonth(addMonths(first.startedAt, 1), locale))
              : s.checkTomorrow
          }
          onClick={() => shell.openOverlay({ screen: 'history' })}
        />
      );
    }
    const w = head.w;
    const openSession = () => shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
    const top = topLift(w);
    const label = sessionLabel(w, ctx.store.workouts, t);
    const tonnes = (workoutVolumeKg(w) / 1000).toFixed(1);
    const minutes = w.finishedAt ? Math.round((w.finishedAt - w.startedAt) / 60000) : 0;
    // The lift's e1RM from then until now (chronological) for the trend line.
    const series = top
      ? finished
          .filter((x) => x.startedAt >= w.startedAt)
          .map((x) => liftE1In(x, top.name))
          .filter((v) => v > 0)
          .reverse()
      : [];
    const recent = top
      ? Math.max(
          0,
          ...finished
            .filter((x) => x.startedAt >= now - 42 * DAY)
            .map((x) => liftE1In(x, top.name)),
        )
      : 0;
    const then = top ? Math.round(top.e1) : 0;
    const cur = top ? Math.round(recent > 0 ? recent : Math.max(...series, top.e1)) : 0;
    const diff = cur - then;
    const growth = then > 0 ? Math.round((diff / then) * 100) : 0;
    const liftName = top ? exName(top.name, locale) : label;
    const spark = (h: number) =>
      series.length > 1 ? <WidgetSpark points={series} height={h} tone="apex" /> : null;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="apex"
          icon="clock-counter-clockwise"
          title={top ? s.agoLift(head.label, liftName, then) : `${head.label} · ${label}`}
          sub={top ? s.nowE1(cur, signed(diff, 0)) : `${tonnes} t · ${minutes} min`}
          onClick={openSession}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="apex"
          kicker={head.label}
          value={top ? signed(diff, 0) : tonnes}
          unit={top ? 'kg' : 't'}
          sub={top ? s.liftThenNow(liftName, then, cur) : label}
          bodyLast
          onClick={openSession}
        >
          {spark(22)}
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="apex"
          kicker={s.onThisDayYear(String(new Date(w.startedAt).getFullYear()))}
          title={`${label} · ${tonnes} t · ${minutes} min`}
          bodyLast
          onClick={openSession}
        >
          {top ? (
            <WidgetStats
              items={[
                { label: `${liftName} · ${s.thenL}`, value: `${then} kg` },
                { label: s.nowL, value: `${cur} kg` },
                {
                  label: s.growthL,
                  value: <WidgetDelta good={growth >= 0}>{`${signed(growth, 0)}%`}</WidgetDelta>,
                },
              ]}
            />
          ) : null}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="apex"
        kicker={s.names.onThisDay}
        onClick={openSession}
        footer={
          <Button variant="secondary" size="sm" fullWidth onClick={openSession}>
            {s.openSession}
          </Button>
        }
      >
        <WidgetList
          rows={hits.map((h) => ({
            label: `${h.label} · ${sessionLabel(h.w, ctx.store.workouts, t)}`,
            value: `${(workoutVolumeKg(h.w) / 1000).toFixed(1)} t`,
          }))}
        />
        {top ? (
          <>
            <div className="uiw-sub">{s.sinceThen(liftName)}</div>
            {spark(64)}
            <WidgetStats
              items={[
                { label: s.thenL, value: `${then} kg` },
                {
                  label: s.nowL,
                  value: (
                    <>
                      {`${cur} kg `}
                      <WidgetDelta good={growth >= 0}>{`${signed(growth, 0)}%`}</WidgetDelta>
                    </>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------- lifetime lifted */

/** Tonnes of each comparison object (names in discover.strings `objects`). */
const OBJ_T = [1.5, 6, 8, 12, 150, 225, 400, 420, 7300, 52000];

const lifetime: WidgetDef = {
  id: 'lifetime-lifted',
  group: 'discover',
  icon: 'stack',
  tone: 'accent',
  name: () => ds(getLocale()).names.lifetime,
  render: (size, ctx) => {
    const { now, locale, shell } = ctx;
    const s = ds(locale);
    const finished = finishedOf(ctx);
    const open = () => shell.goTab('progress');
    const totalT = finished.reduce((a, w) => a + workoutVolumeKg(w), 0) / 1000;
    const hours = Math.round(
      finished.reduce(
        (a, w) => a + Math.min(4 * 3600000, (w.finishedAt ?? w.startedAt) - w.startedAt),
        0,
      ) / 3600000,
    );
    const tTxt = totalT >= 100 ? thousands(totalT) : totalT.toFixed(1);
    let passed = -1;
    OBJ_T.forEach((v, i) => {
      if (totalT >= v) passed = i;
    });
    const next = passed + 1 < OBJ_T.length ? passed + 1 : -1;
    const approx =
      passed >= 0 ? s.approx(Math.floor(totalT / OBJ_T[passed]), s.objects[passed]) : '';
    const nextFrac = next >= 0 ? totalT / OBJ_T[next] : 1;
    const nextTxt = next >= 0 ? `${tTxt} / ${thousands(OBJ_T[next])} t` : '';
    const counts = `${s.sessionsN(finished.length)} · ${s.hoursN(hours)}`;
    if (finished.length === 0)
      return (
        <Empty
          size={size}
          tone="accent"
          icon="stack"
          kicker={s.names.lifetime}
          title="0 t"
          sub={s.firstLift}
          onClick={() => shell.openStart()}
        />
      );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="stack"
          title={s.liftedEver(tTxt)}
          sub={[approx, s.sessionsN(finished.length)].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.lifetimeK}
          value={tTxt}
          unit="t"
          sub={approx || s.sessionsN(finished.length)}
          onClick={open}
        />
      );
    const nextBlock =
      next >= 0 ? (
        <>
          <div className="ul-flex uj-between ug-8">
            <span className="uiw-sub">{s.nextObj(s.objects[next])}</span>
            <span className="uiw-sub">{nextTxt}</span>
          </div>
          <WidgetBar value={nextFrac} />
        </>
      ) : null;
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.names.lifetime}
          value={tTxt}
          unit={`t · ${counts}`}
          bodyLast
          onClick={open}
        >
          {nextBlock}
        </Widget>
      );
    // Tonnage by month, the last 7 calendar months (current last).
    const nd = new Date(now);
    const months = Array.from({ length: 7 }, (_, i) => {
      const from = new Date(nd.getFullYear(), nd.getMonth() - (6 - i), 1).getTime();
      const to = new Date(nd.getFullYear(), nd.getMonth() - (5 - i), 1).getTime();
      const v =
        finished
          .filter((w) => w.startedAt >= from && w.startedAt < to)
          .reduce((a, w) => a + workoutVolumeKg(w), 0) / 1000;
      const label = new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: 'short' })
        .format(new Date(from))
        .replace('.', '');
      return { v, label };
    });
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.names.lifetime}
        badge={`${months[6].label} ${months[6].v.toFixed(1)} t`}
        value={tTxt}
        unit={`t · ${counts}`}
        bodyLast
        onClick={open}
        footer={
          <Button variant="secondary" size="sm" fullWidth onClick={open}>
            {s.openProgress}
          </Button>
        }
      >
        <div className="uiw-sub">{s.byMonth}</div>
        <WidgetBars
          tone="accent"
          values={months.map((m) => m.v)}
          highlight={[6]}
          labels={months.map((m) => m.label)}
          height={44}
        />
        {passed >= 0 ? (
          <WidgetList
            rows={[
              {
                label: `${s.objects[passed]} × ${Math.floor(totalT / OBJ_T[passed])}`,
                value: `${thousands(OBJ_T[passed])} t`,
                icon: 'check',
                tone: 'ok',
              },
            ]}
          />
        ) : null}
        {nextBlock}
      </Widget>
    );
  },
};

/* ---------------------------------------------------------------- night sky */

const nightSky: WidgetDef = {
  id: 'night-sky',
  group: 'discover',
  icon: 'moon-stars',
  tone: 'sleep',
  name: () => ds(getLocale()).names.nightSky,
  render: (size, { store, now, t, locale, shell }) => {
    const s = ds(locale);
    const moon = moonInfo(new Date(now));
    const lit = illumPct(moon);
    const phase = t.moonPhase[moon.name] ?? moon.name;
    const toFull = Math.round(((((0.5 - moon.phase) % 1) + 1) % 1) * 29.53) % 30;
    const fullLine =
      (toFull === 0 ? s.fullTonight : s.fullIn(toFull)) + (toFull <= 4 ? ` — ${s.lighter}` : '');
    const d = new Date(now);
    const plan =
      resolvePlan(store.sleepSchedule, store.sleeps, d.getDay(), now) ??
      usualPlan(store.sleeps, now);
    const hhmm = (m: number) =>
      `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const nowMin = d.getHours() * 60 + d.getMinutes();
    let bedIn: string | null = null;
    if (liveSleep(store.sleeps)) bedIn = s.sleepingNow;
    else if (plan) {
      const overnight = plan.bedMin > plan.wakeMin;
      const beforeWake = overnight ? nowMin < plan.wakeMin : false;
      let left = plan.bedMin - nowMin;
      if (!overnight && left < -12 * 60) left += 1440;
      bedIn = beforeWake || left <= 0 ? s.pastBed : s.bedIn(hm(left));
    }
    const leftShort = bedIn && plan && bedIn !== s.pastBed && bedIn !== s.sleepingNow;
    const openSched = () => shell.openOverlay({ screen: 'sleep', mode: 'schedule' });
    const phaseLine = `${phase} · ${lit}%`;
    const bedLine = plan ? s.bedPlan(hhmm(plan.bedMin), hhmm(plan.wakeMin)) : s.noSchedule;
    const inText = leftShort && plan ? hm(plan.bedMin - nowMin) : '—';
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="sleep"
          icon="moon-stars"
          title={bedLine}
          sub={phaseLine}
          onClick={openSched}
          trailing={
            leftShort ? (
              <Chip size="sm">{s.inX(inText)}</Chip>
            ) : plan ? undefined : (
              <Button variant="secondary" size="sm" onClick={openSched}>
                +
              </Button>
            )
          }
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="sleep"
          title={phaseLine}
          sub={bedIn ?? s.setSchedule}
          onClick={openSched}
        >
          <MoonGlyph size={46} date={now} halo={false} />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="sleep" onClick={openSched}>
          <div className="ul-flex ug-16 ua-center uf-1">
            <MoonGlyph size={84} date={now} halo={false} />
            <div className="ul-flex ul-col ug-4 umw-0">
              <span className="uiw-kicker">{s.tonight}</span>
              <div className="uiw-name">{bedLine}</div>
              <div className="uiw-sub">{[phaseLine, bedIn].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="sleep"
        kicker={s.names.nightSky}
        onClick={openSched}
        footer={
          plan ? (
            <WidgetStats
              items={[
                { label: s.bedL, value: hhmm(plan.bedMin) },
                { label: s.wakeL, value: hhmm(plan.wakeMin) },
                { label: s.inL, value: leftShort ? inText : (bedIn ?? '—') },
              ]}
            />
          ) : (
            <Button variant="secondary" size="sm" fullWidth onClick={openSched}>
              {s.setSchedule}
            </Button>
          )
        }
      >
        <div className="ul-grid uf-1" style={{ placeItems: 'center' }}>
          <MoonGlyph size={130} date={now} />
        </div>
        <div className="utx-center">
          <div className="uiw-name">{phaseLine}</div>
          <Para>{fullLine}</Para>
        </div>
      </Widget>
    );
  },
};

/* --------------------------------------------------------- challenge to try */

/** Sub-app navigation (outside components: the React compiler forbids the write there). */
function goHash(h: string): void {
  window.location.hash = h;
}

function ChallengeToTry({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale, shell } = ctx;
  const s = ds(locale);
  const active = useChallenges();
  const [offset, another] = useDailyOffset('challenge-to-try', now);
  // Candidates: not running, and for "reach X" challenges never one already
  // achieved — the target is lifted to the next step above where you are
  // (within the template's range), otherwise the template is skipped.
  const cands = useMemo(() => {
    const running = activeTemplateIds(active);
    const cctx = challengeCtx(store, now);
    const out: { tmpl: ChallengeTemplate; target: number }[] = [];
    for (const tm of challengeCatalog()) {
      if (running.has(tm.id)) continue;
      if (!isReach(tm.metric)) {
        out.push({ tmpl: tm, target: tm.target });
        continue;
      }
      const days = tm.durations[0] ?? 30;
      const cur = challengeProgress(
        {
          id: 'preview',
          templateId: tm.id,
          startedAt: now,
          endsAt: now + days * DAY,
          target: tm.target,
          status: 'active',
        },
        tm,
        cctx,
      ).value;
      if (cur < tm.target) {
        out.push({ tmpl: tm, target: tm.target });
        continue;
      }
      const step = tm.step > 0 ? tm.step : 1;
      let target = Math.ceil(cur / step) * step;
      if (target <= cur) target += step;
      if (target <= tm.max) out.push({ tmpl: tm, target });
    }
    return out;
  }, [active, store, now]);
  const pick = dailyPick(cands, now, 'challenge', offset);
  const tmpl = pick?.tmpl;
  const target = pick?.target ?? 0;
  const wantProgress = !!tmpl && isReach(tmpl.metric) && (size === 'L' || size === 'XL');
  const progress = useMemo(() => {
    if (!tmpl || !wantProgress) return null;
    const days = tmpl.durations[0] ?? 30;
    return challengeProgress(
      {
        id: 'preview',
        templateId: tmpl.id,
        startedAt: now,
        endsAt: now + days * DAY,
        target,
        status: 'active',
      },
      tmpl,
      challengeCtx(store, now),
    );
  }, [tmpl, target, wantProgress, store, now]);
  const openList = () => goHash('#/challenges');
  if (!tmpl)
    return (
      <Empty
        size={size}
        tone="apex"
        icon="trophy"
        kicker={s.names.challenge}
        title={s.allStarted}
        onClick={openList}
      />
    );
  const title = tmpl.title(t, target);
  const dur = fmtChallengeDuration(tmpl.durations[0] ?? 30, t);
  const start = () => {
    startChallenge(tmpl.id, target, tmpl.durations[0] ?? 30);
    shell.toast({ kind: 'ok', icon: 'trophy', text: s.startedToast(title) });
    openList();
  };
  const nActive = active.filter((c) => c.status === 'active').length;
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="apex"
        icon="trophy"
        title={s.tryX(title)}
        sub={s.fitsYou(dur)}
        onClick={openList}
        trailing={
          <Button variant="secondary" size="sm" onClick={start}>
            {s.start}
          </Button>
        }
      />
    );
  if (size === 'S')
    return (
      <Widget size="S" tone="apex" title={title} sub={s.fitsYou(dur)} onClick={openList}>
        <IconTile tone="apex" icon={tmpl.icon} size={30} />
      </Widget>
    );
  const now1 =
    progress && progress.value > 0
      ? s.youreAt(fmtChallengeValue(tmpl.unit, progress.value, t))
      : null;
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="apex"
        kicker={s.names.challenge}
        title={title}
        sub={now1 ? `${now1} · ${dur}` : tmpl.blurb(t)}
        onClick={openList}
        footer={
          <>
            <Button variant="primary" size="sm" onClick={start}>
              {s.start}
            </Button>
            <Button variant="ghost" size="sm" onClick={another}>
              {s.another}
            </Button>
          </>
        }
      />
    );
  return (
    <Widget
      size="XL"
      tone="apex"
      kicker={s.names.challenge}
      badge={nActive > 0 ? s.activeN(nActive) : dur}
      onClick={openList}
      footer={
        <>
          <div className="uf-1 ul-flex">
            <Button variant="primary" size="sm" fullWidth onClick={start}>
              {s.startChallenge}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={another}>
            {s.another}
          </Button>
        </>
      }
    >
      <div className="ul-flex ua-center ug-14">
        {progress ? (
          <WidgetRing value={progress.pct} size={64} tone="apex">
            {pct(progress.pct)}
            <small>%</small>
          </WidgetRing>
        ) : (
          <IconTile tone="apex" icon={tmpl.icon} size={56} />
        )}
        <div className="umw-0">
          <Para strong>{title}</Para>
          <div className="uiw-sub">{now1 ?? s.fitsYou(dur)}</div>
        </div>
      </div>
      <Para>{tmpl.blurb(t)}</Para>
    </Widget>
  );
}

const challenge: WidgetDef = {
  id: 'challenge-to-try',
  group: 'discover',
  icon: 'trophy',
  tone: 'apex',
  name: () => ds(getLocale()).names.challenge,
  render: (size, ctx) => <ChallengeToTry size={size} ctx={ctx} />,
};

/* ------------------------------------------------------------ rest-day idea */

const IDEA_DEFAULTS = ['mobility', 'walk', 'sauna'];
const IDEA_MIN: Record<string, number> = {
  mobility: 20,
  walk: 40,
  sauna: 15,
  yoga: 30,
  massage: 30,
  cold: 5,
};

function readinessTone(r: number): Tone {
  if (r < 0.7) return 'danger';
  if (r < 0.9) return 'rest';
  return 'ok';
}

const restIdea: WidgetDef = {
  id: 'rest-day-idea',
  group: 'discover',
  icon: 'flower-lotus',
  tone: 'rest',
  name: () => ds(getLocale()).names.restIdea,
  render: (size, ctx) => {
    const { store, now, t, locale, shell } = ctx;
    const s = ds(locale);
    const finished = finishedOf(ctx);
    const today = dayKey(now);
    const trainedToday = finished.some((w) => dayKey(w.startedAt) === today);
    const trainedYesterday = finished.some((w) => dayKey(w.startedAt) === today - 1);
    const ready = [...muscleReadiness(finished, now).values()]
      .filter((m) => m.daysSince !== null)
      .sort((a, b) => a.readiness - b.readiness);
    const low = ready[0] ?? null;
    const a = readProgramCache();
    const wd = ((new Date(now).getDay() + 6) % 7) + 1;
    const isRest =
      !trainedToday &&
      (activeRestPeriod(now) !== null ||
        (a
          ? !programDayHasPlan(a, wd)
          : finished.length > 0 && (trainedYesterday || (low !== null && low.readiness < 0.75))));
    const openLog = () => shell.openOverlay({ screen: 'log-activity', cat: 'recovery' });
    if (!isRest && size === 'XL') {
      // Training day: no ideas yet — show how recovered you are and when the
      // next rest day is, so the big card is never a blank square.
      let nextRest: number | null = null;
      if (a)
        for (let i = 1; i <= 7 && nextRest === null; i++) {
          const ts = now + i * DAY;
          if (!programDayHasPlan(a, ((new Date(ts).getDay() + 6) % 7) + 1)) nextRest = ts;
        }
      const bars = ready.slice(0, 4);
      return (
        <Widget
          size="XL"
          tone="rest"
          kicker={s.restIdeaK}
          badge={`${fmtWeekdayShort(now, locale)} ${fmtDayMonth(now, locale)}`}
          title={s.trainingDay}
          sub={s.trainingSub}
          onClick={openLog}
          footer={
            <WidgetStats
              items={[
                {
                  label: s.nextRestL,
                  value:
                    nextRest !== null
                      ? `${fmtWeekdayShort(nextRest, locale)} ${fmtDayMonth(nextRest, locale)}`
                      : s.noRestPlan,
                },
              ]}
            />
          }
        >
          <div className="uiw-sub">{s.readyK}</div>
          {bars.length > 0 ? (
            bars.map((m) => (
              <div key={m.muscle} className="ul-flex ua-center ug-10">
                <span className="uiw-sub" style={{ width: 72 }}>
                  {muscleName(t, m.muscle)}
                </span>
                <span className="uf-1 ul-flex">
                  <WidgetBar value={m.readiness} tone={readinessTone(m.readiness)} />
                </span>
                <span className="uiw-sub utx-right" style={{ width: 36 }}>
                  {`${pct(m.readiness)}%`}
                </span>
              </div>
            ))
          ) : (
            <div className="ul-grid uf-1" style={{ placeItems: 'center' }}>
              <IconTile tone="rest" icon="flower-lotus" size={56} />
            </div>
          )}
        </Widget>
      );
    }
    if (!isRest)
      return (
        <Empty
          size={size}
          tone="rest"
          icon="flower-lotus"
          kicker={s.restIdeaK}
          title={s.trainingDay}
          sub={s.trainingSub}
          onClick={openLog}
        />
      );
    // Ideas: the recovery things you actually do (last 8 weeks), then defaults.
    const since = now - 56 * DAY;
    const count = new Map<string, number[]>();
    for (const x of store.activities) {
      if (x.finishedAt === null || x.startedAt < since) continue;
      if (x.category !== 'recovery' && x.type !== 'walk') continue;
      const arr = count.get(x.type) ?? [];
      arr.push(durationMin(x));
      count.set(x.type, arr);
    }
    const keys = [...count.entries()]
      .sort((p, q) => q[1].length - p[1].length)
      .map(([k]) => k)
      .concat(IDEA_DEFAULTS)
      .filter((k, i, arr) => arr.indexOf(k) === i && activityType(k))
      .slice(0, 3);
    const ideas = keys.map((k) => {
      const mins = (count.get(k) ?? []).slice().sort((p, q) => p - q);
      const med = mins.length ? mins[Math.floor(mins.length / 2)] : (IDEA_MIN[k] ?? 20);
      return {
        key: k,
        name: t.actType[k] ?? k,
        min: Math.max(5, Math.round(med / 5) * 5),
        icon: activityType(k)?.icon ?? 'flower-lotus',
      };
    });
    const top = ideas[0];
    const startTop = () => shell.openOverlay({ screen: 'activity', newType: top.key });
    const lowName = low ? muscleName(t, low.muscle) : '';
    const lowPct = low ? pct(low.readiness) : 100;
    const tired = low !== null && low.readiness < 0.9;
    const why = tired ? s.keepEasy(lowName, lowPct) : s.allFresh;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="rest"
          icon="flower-lotus"
          title={s.tryMin(top.min, top.name.toLowerCase())}
          sub={tired ? s.stillAt(lowName, lowPct) : s.allFresh}
          onClick={openLog}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="rest"
          kicker={s.restDay}
          value={top.min}
          unit="min"
          sub={tired ? `${top.name} · ${lowName} ${lowPct}%` : top.name}
          bodyLast
          onClick={openLog}
        >
          {low ? <WidgetBar value={low.readiness} /> : null}
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="rest"
          kicker={s.restIdeaK}
          onClick={openLog}
          footer={
            <Button variant="primary" size="sm" onClick={startTop}>
              {s.startX(top.name.toLowerCase())}
            </Button>
          }
        >
          <div className="ul-flex ug-6 ul-wrap">
            {ideas.map((i) => (
              <Chip key={i.key} size="sm">
                {`${i.name} · ${s.minN(i.min)}`}
              </Chip>
            ))}
          </div>
          <div className="uiw-sub">{why}</div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="rest"
        kicker={s.restIdeaK}
        badge={`${fmtWeekdayShort(now, locale)} ${fmtDayMonth(now, locale)}`}
        onClick={openLog}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={startTop}>
            {s.startX(top.name.toLowerCase())}
          </Button>
        }
      >
        <div className="uiw-sub">{tired ? s.recoveryK : s.allFresh}</div>
        {ready.slice(0, 3).map((m) => (
          <div key={m.muscle} className="ul-flex ua-center ug-10">
            <span className="uiw-sub" style={{ width: 72 }}>
              {muscleName(t, m.muscle)}
            </span>
            <span className="uf-1 ul-flex">
              <WidgetBar value={m.readiness} tone={readinessTone(m.readiness)} />
            </span>
            <span className="uiw-sub utx-right" style={{ width: 36 }}>
              {`${pct(m.readiness)}%`}
            </span>
          </div>
        ))}
        <WidgetList
          rows={ideas.map((i) => ({
            label: i.name,
            value: s.minN(i.min),
            icon: i.icon,
          }))}
        />
      </Widget>
    );
  },
};

/* ------------------------------------------------------------------- export */

const exerciseOfDay: WidgetDef = {
  id: 'exercise-of-the-day',
  group: 'discover',
  icon: 'barbell',
  tone: 'accent',
  name: () => ds(getLocale()).names.exercise,
  render: (size, ctx) => <ExerciseOfDay size={size} ctx={ctx} />,
};

export const DISCOVER_WIDGETS: WidgetDef[] = [
  exerciseOfDay,
  tip,
  kit,
  onThisDay,
  lifetime,
  nightSky,
  challenge,
  restIdea,
];
