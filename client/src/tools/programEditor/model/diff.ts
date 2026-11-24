import { isBare, type ProgramDoc } from './doc';

export type Change =
  | { op: 'add'; day: number; name: string; sets: number; reps: number }
  | { op: 'remove'; day: number; name: string }
  | {
      op: 'change';
      day: number;
      name: string;
      what:
        | 'sets'
        | 'reps'
        | 'weight'
        | 'rpe'
        | 'rest'
        | 'bare'
        | 'name'
        | 'note'
        | 'dropLast'
        | 'group'
        | 'day'
        | 'equipment'
        | 'warmup'
        | 'cardio'
        | 'dayName'
        | 'muscles'
        | 'activities';
    };

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const sortedBy = <X extends { id: string }>(xs: readonly X[] | undefined): X[] =>
  [...(xs ?? [])].sort((x, y) => (x.id < y.id ? -1 : 1));

/**
 * What changed from `live` to `draft`: one entry per added / removed row and per changed row (strength rows), plus a
 * `change` for everything else a client's program holds that the client would notice: a row moved to another weekday,
 * its equipment, a warm-up (exercises, weights), a cardio row, a day's name, its target muscles and its planned
 * activities. A version that changed only those is no longer an empty version with an empty summary.
 */
function diffWeek(live: ProgramDoc, draft: ProgramDoc): Change[] {
  const out: Change[] = [];
  const liveById = new Map(live.items.map((i) => [i.id, i]));
  const draftIds = new Set(draft.items.map((i) => i.id));
  for (const d of draft.items) {
    if (d.kind !== 'strength') continue;
    const l = liveById.get(d.id);
    if (!l) {
      out.push({
        op: 'add',
        day: d.day,
        name: d.name,
        sets: isBare(d) ? 0 : d.sets,
        reps: isBare(d) ? 0 : d.reps,
      });
      continue;
    }
    if (l.name !== d.name) out.push({ op: 'change', day: d.day, name: d.name, what: 'name' });
    if (isBare(l) !== isBare(d)) out.push({ op: 'change', day: d.day, name: d.name, what: 'bare' });
    else if (!isBare(d)) {
      if (l.sets !== d.sets) out.push({ op: 'change', day: d.day, name: d.name, what: 'sets' });
      if (l.reps !== d.reps) out.push({ op: 'change', day: d.day, name: d.name, what: 'reps' });
      // a load given as a percent of the person's max is a load change; a rep range is a reps change
      if (
        (l.targetWeight ?? 0) !== (d.targetWeight ?? 0) ||
        (l.targetPct ?? 0) !== (d.targetPct ?? 0)
      )
        out.push({ op: 'change', day: d.day, name: d.name, what: 'weight' });
      if ((l.repsMin ?? 0) !== (d.repsMin ?? 0) && l.reps === d.reps)
        out.push({ op: 'change', day: d.day, name: d.name, what: 'reps' });
      if ((l.targetRpe ?? 0) !== (d.targetRpe ?? 0))
        out.push({ op: 'change', day: d.day, name: d.name, what: 'rpe' });
      if ((l.restSec ?? 0) !== (d.restSec ?? 0))
        out.push({ op: 'change', day: d.day, name: d.name, what: 'rest' });
      if ((l.note ?? '').trim() !== (d.note ?? '').trim())
        out.push({ op: 'change', day: d.day, name: d.name, what: 'note' });
      if (!!l.dropLast !== !!d.dropLast)
        out.push({ op: 'change', day: d.day, name: d.name, what: 'dropLast' });
    }
    if ((l.groupId ?? null) !== (d.groupId ?? null))
      out.push({ op: 'change', day: d.day, name: d.name, what: 'group' });
    if (l.day !== d.day) out.push({ op: 'change', day: d.day, name: d.name, what: 'day' });
    if (!same([...(l.equipment ?? [])].sort(), [...(d.equipment ?? [])].sort()))
      out.push({ op: 'change', day: d.day, name: d.name, what: 'equipment' });
  }
  // warm-up, cool-down and cardio rows: added, removed or edited
  for (const d of draft.items) {
    if (d.kind === 'strength') continue;
    const l = liveById.get(d.id);
    const what = d.kind === 'cardio' ? 'cardio' : 'warmup';
    if (
      !l ||
      l.day !== d.day ||
      l.name !== d.name ||
      (l.durationMin ?? 0) !== (d.durationMin ?? 0) ||
      !same(l.warmupItems, d.warmupItems)
    )
      out.push({ op: 'change', day: d.day, name: d.name, what });
  }
  for (const l of live.items)
    if (l.kind !== 'strength' && !draftIds.has(l.id))
      out.push({
        op: 'change',
        day: l.day,
        name: l.name,
        what: l.kind === 'cardio' ? 'cardio' : 'warmup',
      });
  // day level: name, target muscles, planned activities
  for (let day = 1; day <= 7; day++) {
    const k = String(day);
    const label = draft.dayNames?.[k] ?? live.dayNames?.[k] ?? '';
    if ((live.dayNames?.[k] ?? '') !== (draft.dayNames?.[k] ?? ''))
      out.push({ op: 'change', day, name: label, what: 'dayName' });
    if (
      !same(
        [...(live.targetMuscles?.[k] ?? [])].sort(),
        [...(draft.targetMuscles?.[k] ?? [])].sort(),
      )
    )
      out.push({ op: 'change', day, name: label, what: 'muscles' });
    const la = sortedBy(live.activities?.filter((a) => a.day === day));
    const da = sortedBy(draft.activities?.filter((a) => a.day === day));
    if (!same(la, da)) out.push({ op: 'change', day, name: label, what: 'activities' });
  }
  for (const l of live.items)
    if (l.kind === 'strength' && !draftIds.has(l.id))
      out.push({ op: 'remove', day: l.day, name: l.name });
  return out;
}

/** The days of cycle week `cw` (2..) of a document as a plain document; a week the document does not have is an empty one. */
function weekDoc(doc: ProgramDoc, cw: number): ProgramDoc {
  const w = (doc as { cycle?: { weeks?: Array<Partial<ProgramDoc>> } }).cycle?.weeks?.[cw - 2];
  return {
    ...doc,
    items: w?.items ?? [],
    dayNames: w?.dayNames ?? {},
    targetMuscles: w?.targetMuscles ?? {},
  };
}

/**
 * What changed from `live` to `draft`: the program's own week, then every other week of a weekly cycle (a program without
 * a cycle has none). Names come with the weekday; the week is not named, so a changed row reads as in the base week.
 */
export function diffPrograms(live: ProgramDoc, draft: ProgramDoc): Change[] {
  const out = diffWeek(live, draft);
  const len = (d: ProgramDoc) => (d as { cycle?: { length?: number } }).cycle?.length ?? 1;
  for (let cw = 2; cw <= Math.max(len(live), len(draft)); cw++)
    out.push(
      ...diffWeek(
        { ...weekDoc(live, cw), activities: [] },
        { ...weekDoc(draft, cw), activities: [] },
      ),
    );
  return out;
}
