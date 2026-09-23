/**
 * Exercise picker v2 — the data behind "Add exercise": muscle families and
 * their sub-muscles with readiness, one list of pickable exercises (catalog +
 * your own history) annotated with what matters when choosing — yours / done
 * today / gym availability / photo — and the day-aware suggestions (usual,
 * weak point, good fit) with a progression target. Pure over its inputs (the
 * workouts, the gym, "now"), so it unit-tests without React.
 */
import type { Gym, Workout } from './types';
import {
  BUILT_IN_CATALOG,
  canonicalExerciseName,
  muscleInfoByName,
  richExerciseById,
  richExerciseByName,
  secondaryMusclesOf,
  subRegionsById,
  type MuscleGroup,
} from './data/exercises';
import type { EquipmentId } from './data/equipment';
import type { FocusMuscle } from './data/subregions';
import { describeDay, exerciseDay, type DayReadout } from './data/daySuggest';
import { muscleReadiness, type ReadyState } from './recovery';
import { volumeWeakPoints } from './weakpoints';
import { nextTarget, topHistory, type Target } from './progression';
import { isStrengthExercise, resolveMuscles, topSet } from './store';

// --- Families & sub-muscles -------------------------------------------------

export type FamilyId = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

/** A sub-muscle chip: a coarse group, or a fine region of a split group. */
export type SubId = MuscleGroup | FocusMuscle;

export interface Family {
  id: FamilyId;
  /** Coarse groups whose exercises belong here (primary muscle). */
  groups: MuscleGroup[];
  /** Chips under the family (empty = the family is one muscle). */
  subs: SubId[];
  /** Silhouette side that shows it best. */
  view: 'front' | 'back';
}

export const FAMILIES: Family[] = [
  { id: 'chest', groups: ['chest'], subs: ['chest-upper', 'chest-lower'], view: 'front' },
  {
    id: 'back',
    groups: ['lats', 'traps', 'lower_back', 'back'],
    subs: ['lats', 'traps', 'lower_back'],
    view: 'back',
  },
  {
    id: 'shoulders',
    groups: ['shoulders'],
    subs: ['delt-front', 'delt-side', 'delt-rear'],
    view: 'front',
  },
  {
    id: 'arms',
    groups: ['biceps', 'triceps', 'forearms'],
    subs: ['biceps', 'triceps', 'forearms'],
    view: 'front',
  },
  {
    id: 'legs',
    groups: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'],
    subs: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'],
    view: 'front',
  },
  { id: 'core', groups: ['core'], subs: [], view: 'front' },
];

const FOCUS_IDS = new Set<string>([
  'delt-front',
  'delt-side',
  'delt-rear',
  'chest-upper',
  'chest-lower',
]);
export function isFocusSub(s: SubId): s is FocusMuscle {
  return FOCUS_IDS.has(s);
}

export function familyOf(m: MuscleGroup | null | undefined): FamilyId | null {
  if (!m) return null;
  return FAMILIES.find((f) => f.groups.includes(m))?.id ?? null;
}

// --- Readiness per family / sub ---------------------------------------------

export interface Readiness {
  state: ReadyState;
  /** Whole days since last trained; null = not in the lookback window. */
  days: number | null;
}

const SEVERITY: Record<ReadyState, number> = { recovering: 3, nearly: 2, ready: 1, stale: 0 };

/** Worst state among the groups (so a half-recovered family never reads "ready"). */
function worst(list: Readiness[]): Readiness {
  const trained = list.filter((r) => r.days !== null);
  if (trained.length === 0) return { state: 'stale', days: null };
  return trained.reduce((a, b) =>
    SEVERITY[b.state] > SEVERITY[a.state] ||
    (SEVERITY[b.state] === SEVERITY[a.state] && (b.days ?? 0) < (a.days ?? 0))
      ? b
      : a,
  );
}

export function readinessByGroup(finished: Workout[], now: number): Map<MuscleGroup, Readiness> {
  const out = new Map<MuscleGroup, Readiness>();
  for (const [m, r] of muscleReadiness(finished, now)) {
    out.set(m, {
      state: r.state,
      days: r.daysSince === null ? null : Math.floor(r.daysSince),
    });
  }
  return out;
}

export function familyReadiness(f: Family, map: Map<MuscleGroup, Readiness>): Readiness {
  return worst(f.groups.map((g) => map.get(g)).filter((x): x is Readiness => !!x));
}

export function subReadiness(s: SubId, map: Map<MuscleGroup, Readiness>): Readiness | null {
  if (isFocusSub(s)) return map.get(s.startsWith('delt') ? 'shoulders' : 'chest') ?? null;
  return map.get(s) ?? null;
}

// --- Today's day reference (which muscles the session is about) --------------

export type DayFrom = 'program' | 'logged' | 'weekday' | 'overall';

export interface DayRef {
  groups: MuscleGroup[];
  readout: DayReadout | null;
  from: DayFrom | null;
}

const TRAINABLE = new Set<MuscleGroup>([...FAMILIES.flatMap((f) => f.groups)]);

function orderedGroups(w: Workout, requireSet: boolean): [MuscleGroup, number][] {
  const order: MuscleGroup[] = [];
  const counts = new Map<MuscleGroup, number>();
  for (const e of [...w.exercises].sort((a, b) => a.position - b.position)) {
    if (requireSet && e.sets.length === 0) continue;
    const p = resolveMuscles(e).primary;
    if (!p || !TRAINABLE.has(p)) continue;
    if (!counts.has(p)) order.push(p);
    counts.set(p, (counts.get(p) ?? 0) + Math.max(1, e.sets.length));
  }
  return order.map((m) => [m, counts.get(m) as number]);
}

/**
 * The muscles this session is about: program-day targets, else what's been
 * logged so far, else the same weekday last time, else the last session.
 */
export function dayReference(workout: Workout, finished: Workout[]): DayRef {
  const past = finished
    .filter((w) => w.id !== workout.id)
    .sort((a, b) => b.startedAt - a.startedAt);
  const program = (workout.targetMuscles ?? []).filter((m): m is MuscleGroup =>
    TRAINABLE.has(m as MuscleGroup),
  );
  let ref: [MuscleGroup, number][] = program.map((m) => [m, 1]);
  let from: DayFrom | null = ref.length ? 'program' : null;
  if (!ref.length) {
    ref = orderedGroups(workout, true);
    if (ref.length) from = 'logged';
  }
  if (!ref.length) {
    const wd = new Date(workout.startedAt).getDay();
    const same = past.find((w) => new Date(w.startedAt).getDay() === wd);
    if (same) {
      ref = orderedGroups(same, false);
      if (ref.length) from = 'weekday';
    }
    if (!ref.length && past[0]) {
      ref = orderedGroups(past[0], false);
      if (ref.length) from = 'overall';
    }
  }
  return { groups: ref.map(([m]) => m), readout: describeDay(ref), from };
}

/** Does a primary muscle belong to today's day (split-aware)? */
export function fitsDay(day: DayRef, primary: MuscleGroup | null): boolean {
  if (!primary || !day.readout) return false;
  const r = day.readout;
  if (r.kind === 'full') return true;
  if (r.kind === 'split') return exerciseDay(primary) === r.split;
  return r.groups.includes(primary);
}

// --- Pickable exercises -----------------------------------------------------

export interface PickItem {
  /** Stable key: canonical name, lower-cased. */
  key: string;
  /** Name to store/display (canonical English for catalog entries). */
  name: string;
  catalogId: string | null;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
  image: string | null;
  images: string[];
  compound: boolean;
  /** Sessions in history that included it. */
  timesDone: number;
  lastAt: number | null;
  last: { reps: number; weight: number | null } | null;
  /** Logged in THIS session already (never blocked — just shown). */
  doneToday: { sets: number; reps: number; weight: number | null } | null;
  /** The gym stocks its equipment (true when the gym lists no inventory). */
  available: boolean;
  /** Generic "how good a pick is this" (category, level, kit). */
  quality: number;
}

const GOOD_KIT = new Set<string>(['body', 'dumbbell', 'barbell', 'cable', 'machine']);

function quality(catalogId: string | null, equipment: string | null): number {
  const rich = richExerciseById(catalogId);
  let s = 0;
  if (rich?.category === 'strength') s += 18;
  else if (rich?.category === 'powerlifting') s += 10;
  else if (rich?.category === 'stretching') s -= 30;
  else if (rich?.category === 'plyometrics') s -= 8;
  else if (rich?.category === 'cardio') s -= 40;
  if (rich?.level === 'beginner') s += 8;
  else if (rich?.level === 'intermediate') s += 5;
  else if (rich?.level === 'expert') s -= 8;
  if (rich?.mechanic === 'compound') s += 6;
  if (equipment && GOOD_KIT.has(equipment)) s += 4;
  return s;
}

export function gymHas(gym: Gym | null | undefined, equipment: EquipmentId | null): boolean {
  const inv = gym?.inventory;
  if (!inv || inv.length === 0 || !equipment) return true;
  return inv.includes(equipment);
}

/**
 * Every pickable strength exercise: the built-in catalog plus anything only in
 * your history (custom names), each annotated with history, today and gym.
 */
export function buildPickItems(workout: Workout, all: Workout[], gym: Gym | null): PickItem[] {
  // History by canonical key.
  const hist = new Map<
    string,
    { n: number; lastAt: number; last: PickItem['last']; raw: string }
  >();
  for (const w of all) {
    if (w.id === workout.id) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || e.sets.length === 0) continue;
      const key = canonicalExerciseName(e.name).toLowerCase();
      const top = topSet(e.sets) ?? e.sets[e.sets.length - 1];
      const cur = hist.get(key);
      if (!cur) {
        hist.set(key, {
          n: 1,
          lastAt: w.startedAt,
          last: top ? { reps: top.reps, weight: top.weight } : null,
          raw: e.name.trim(),
        });
      } else {
        cur.n += 1;
        if (w.startedAt > cur.lastAt) {
          cur.lastAt = w.startedAt;
          cur.last = top ? { reps: top.reps, weight: top.weight } : cur.last;
        }
      }
    }
  }
  const today = new Map<string, PickItem['doneToday']>();
  for (const e of workout.exercises) {
    if (!isStrengthExercise(e) || e.sets.length === 0) continue;
    const top = topSet(e.sets) ?? e.sets[e.sets.length - 1];
    today.set(canonicalExerciseName(e.name).toLowerCase(), {
      sets: e.sets.length,
      reps: top?.reps ?? 0,
      weight: top?.weight ?? null,
    });
  }

  const out: PickItem[] = [];
  const seen = new Set<string>();
  for (const c of BUILT_IN_CATALOG) {
    if (c.muscle === 'cardio') continue;
    const name = c.names[0];
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const rich = richExerciseById(c.id);
    if (rich?.category === 'cardio' || rich?.category === 'stretching') continue;
    seen.add(key);
    const equipment = (rich?.equipment ?? c.equipment ?? null) as EquipmentId | null;
    const h = hist.get(key);
    const primary = rich?.primaryMuscles[0] ?? c.muscle;
    out.push({
      key,
      name,
      catalogId: c.id,
      primary,
      secondary: rich?.secondaryMuscles ?? secondaryMusclesOf(c),
      equipment,
      image: rich?.images[0] ?? null,
      images: rich?.images ?? [],
      compound: rich?.mechanic === 'compound',
      timesDone: h?.n ?? 0,
      lastAt: h?.lastAt ?? null,
      last: h?.last ?? null,
      doneToday: today.get(key) ?? null,
      available: gymHas(gym, equipment),
      quality: quality(c.id, equipment),
    });
  }
  // Custom exercises done only today still show (marked done).
  for (const e of workout.exercises) {
    const key = canonicalExerciseName(e.name).toLowerCase();
    if (today.has(key) && !hist.has(key) && !seen.has(key)) {
      hist.set(key, { n: 0, lastAt: 0, last: null, raw: e.name.trim() });
    }
  }
  // History-only (custom) exercises.
  for (const [key, h] of hist) {
    if (seen.has(key)) continue;
    seen.add(key);
    const info = muscleInfoByName(h.raw);
    const rich = richExerciseByName(h.raw);
    const equipment = (info?.equipment ?? null) as EquipmentId | null;
    out.push({
      key,
      name: h.raw,
      catalogId: rich?.id ?? null,
      primary: info && info.primary !== 'cardio' ? info.primary : null,
      secondary: info?.secondary ?? [],
      equipment,
      image: rich?.images[0] ?? null,
      images: rich?.images ?? [],
      compound: false,
      timesDone: h.n,
      lastAt: h.n > 0 ? h.lastAt : null,
      last: h.last,
      doneToday: today.get(key) ?? null,
      available: gymHas(gym, equipment),
      quality: 10,
    });
  }
  return out;
}

// --- Filtering & ordering ---------------------------------------------------

export interface PickFilter {
  family?: FamilyId | null;
  sub?: SubId | null;
  /** Empty = any equipment. */
  equipment?: EquipmentId[];
  /** Hide what the gym can't equip (search keeps everything). */
  onlyGym?: boolean;
}

export function matchesSub(item: PickItem, sub: SubId): boolean {
  if (isFocusSub(sub)) {
    const r = item.catalogId ? subRegionsById(item.catalogId) : null;
    return !!r?.primary.includes(sub);
  }
  return item.primary === sub;
}

export function applyFilter(items: PickItem[], f: PickFilter): PickItem[] {
  const fam = f.family ? FAMILIES.find((x) => x.id === f.family) : null;
  const eq = f.equipment ?? [];
  return items.filter(
    (i) =>
      (!fam || (i.primary !== null && fam.groups.includes(i.primary))) &&
      (!f.sub || matchesSub(i, f.sub)) &&
      (eq.length === 0 || (i.equipment !== null && eq.includes(i.equipment))) &&
      (!f.onlyGym || i.available),
  );
}

/** Group-screen order: available first, then yours (most done), then quality. */
export function sortForBrowse(items: PickItem[]): PickItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.available) - Number(a.available) ||
      Number(b.timesDone > 0) - Number(a.timesDone > 0) ||
      b.timesDone - a.timesDone ||
      Number(!!b.image) - Number(!!a.image) ||
      b.quality - a.quality ||
      a.name.localeCompare(b.name),
  );
}

/** Equipment present in a list, with counts, most common first. */
export function equipmentCounts(items: PickItem[]): { id: EquipmentId; n: number }[] {
  const m = new Map<EquipmentId, number>();
  for (const i of items) if (i.equipment) m.set(i.equipment, (m.get(i.equipment) ?? 0) + 1);
  return [...m].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
}

// --- Suggestions ------------------------------------------------------------

export type SuggestReason = 'usual' | 'weak' | 'fit';

export interface Suggestion {
  item: PickItem;
  reason: SuggestReason;
  /** The muscle the reason is about (weak point / ready muscle). */
  muscle: MuscleGroup | null;
  target: Target | null;
}

function targetFor(item: PickItem, finished: Workout[], beforeTs: number): Target | null {
  if (item.timesDone === 0) return null;
  const hist = topHistory(finished, item.name, beforeTs);
  if (hist.length === 0) return null;
  return nextTarget(hist, {
    equipment: item.equipment ? [item.equipment] : [],
    primary: item.primary,
    bodyweight: item.last?.weight === null,
  });
}

/**
 * Up to `count` suggestions for this session, one reason each, never an
 * exercise already done today:
 *   • usual — what you've done on days like this, most frequent first;
 *   • weak  — a chronically under-trained muscle of the day, your best move for it;
 *   • fit   — the best catalog move for a ready target you haven't covered.
 * With no day reference, targets fall back to the muscles that are ready.
 * `scope` narrows to one family / sub-muscle (the group screen's "best now").
 */
export function suggest(
  items: PickItem[],
  day: DayRef,
  finished: Workout[],
  readiness: Map<MuscleGroup, Readiness>,
  now: number,
  opts: { count?: number; family?: FamilyId | null; sub?: SubId | null; beforeTs?: number } = {},
): Suggestion[] {
  const count = opts.count ?? 5;
  const beforeTs = opts.beforeTs ?? now;
  const fam = opts.family ? FAMILIES.find((f) => f.id === opts.family) : null;
  const inScope = (i: PickItem) =>
    !i.doneToday &&
    i.available &&
    i.primary !== null &&
    (!fam || fam.groups.includes(i.primary)) &&
    (!opts.sub || matchesSub(i, opts.sub));
  const pool = items.filter(inScope);

  let targets = day.groups;
  const scoped = !!fam;
  if (!targets.length || scoped) {
    targets = fam
      ? fam.groups
      : [...readiness]
          .filter(([, r]) => r.state === 'ready' || r.state === 'stale')
          .map(([m]) => m);
  }
  const fits = (i: PickItem) =>
    scoped ? true : day.readout ? fitsDay(day, i.primary) : targets.includes(i.primary!);
  const ok = (i: PickItem) => readiness.get(i.primary!)?.state !== 'recovering';

  const out: Suggestion[] = [];
  const used = new Set<string>();
  const add = (item: PickItem, reason: SuggestReason, muscle: MuscleGroup | null) => {
    if (used.has(item.key) || out.length >= count) return;
    used.add(item.key);
    out.push({ item, reason, muscle, target: targetFor(item, finished, beforeTs) });
  };

  // usual
  const usual = pool
    .filter((i) => i.timesDone > 0 && fits(i) && ok(i))
    .sort((a, b) => b.timesDone - a.timesDone || (b.lastAt ?? 0) - (a.lastAt ?? 0));
  const nUsual = Math.max(1, Math.ceil(count / 2));
  for (const i of usual.slice(0, nUsual)) add(i, 'usual', i.primary);

  // weak points
  const weak = volumeWeakPoints(finished, now).map((w) => w.muscle);
  for (const m of weak) {
    if (out.length >= count) break;
    if (!scoped && !targets.includes(m) && !(day.readout && fitsDay(day, m))) continue;
    if (scoped && !fam!.groups.includes(m)) continue;
    const best = pool
      .filter((i) => i.primary === m && !used.has(i.key))
      .sort((a, b) => b.timesDone - a.timesDone || b.quality - a.quality)[0];
    if (best) add(best, 'weak', m);
  }

  // good fits — one per target first, then the rest by quality
  const fitPool = pool
    .filter((i) => fits(i) && ok(i) && !used.has(i.key) && i.image)
    .sort((a, b) => b.quality - a.quality || Number(b.compound) - Number(a.compound));
  for (const m of targets) {
    const best = fitPool.find((i) => i.primary === m && !used.has(i.key));
    if (best) add(best, 'fit', m);
  }
  for (const i of fitPool) add(i, 'fit', i.primary);
  // any remaining usual
  for (const i of usual) add(i, 'usual', i.primary);
  return out;
}

/** "Days ago" for a timestamp, floored; null-safe. */
export function daysAgo(ts: number | null, now: number): number | null {
  return ts === null ? null : Math.max(0, Math.floor((now - ts) / 86400000));
}
