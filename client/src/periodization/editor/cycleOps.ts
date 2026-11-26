/**
 * Pure edits of a program's cycle for the editor (Periodization chunk). The program document keeps cycle week 1 as its own
 * days (`items`, `dayNames`, `targetMuscles`) and cycle weeks 2..length in `cycle.weeks`; the editor shows one week at a time
 * as a plain program (`weekView`) and every edit is put back with `mergeWeek`.
 */
import type { ProgramDoc } from '../../tools/programEditor';
import type { CycleLabel, ProgramCycle, ProgramItem, WeekPlan } from '../../views/programs/model';
import { MAX_CYCLE, MIN_CYCLE } from '../cycle';
import { cloneItems } from '../cycleData';

export type CycleDoc = ProgramDoc & { cycle?: ProgramCycle };

export const DEFAULT_CYCLE = 4;

const copyOf = (w: Pick<WeekPlan, 'items' | 'dayNames' | 'targetMuscles'>): WeekPlan => ({
  dayNames: { ...w.dayNames },
  targetMuscles: Object.fromEntries(Object.entries(w.targetMuscles).map(([k, v]) => [k, [...v]])),
  items: cloneItems(w.items as unknown as ProgramItem[]),
});

/** The days of cycle week `cw` (1-based) of the document. */
export function weekOf(doc: CycleDoc, cw: number): WeekPlan {
  if (cw <= 1 || !doc.cycle) {
    return {
      ...(doc.cycle?.baseLabel ? { label: doc.cycle.baseLabel } : {}),
      dayNames: doc.dayNames,
      targetMuscles: doc.targetMuscles,
      items: doc.items as unknown as ProgramItem[],
    };
  }
  return doc.cycle.weeks[cw - 2] ?? copyOf(weekOf(doc, 1));
}

/** The label (Deload, Test, Peak) of cycle week `cw`. */
export const labelOfWeek = (doc: CycleDoc, cw: number): CycleLabel | undefined =>
  cw <= 1 ? doc.cycle?.baseLabel : doc.cycle?.weeks[cw - 2]?.label;

/** The document as the editor shows it for week `cw`: the same program, that week's days. */
export function weekView(doc: CycleDoc, cw: number): CycleDoc {
  if (cw <= 1 || !doc.cycle) return doc;
  const w = weekOf(doc, cw);
  return {
    ...doc,
    items: w.items as unknown as ProgramDoc['items'],
    dayNames: w.dayNames,
    targetMuscles: w.targetMuscles,
  };
}

/** An edit made on the view of week `cw` put back into the full document. Activities and blocks are the same every week. */
export function mergeWeek(doc: CycleDoc, cw: number, next: CycleDoc): CycleDoc {
  if (cw <= 1 || !doc.cycle) return { ...next, ...(doc.cycle ? { cycle: doc.cycle } : {}) };
  const weeks = doc.cycle.weeks.map((w, i) =>
    i === cw - 2
      ? {
          ...w,
          dayNames: next.dayNames,
          targetMuscles: next.targetMuscles,
          items: next.items as unknown as ProgramItem[],
        }
      : w,
  );
  return {
    ...doc,
    activities: next.activities,
    blocks: next.blocks,
    cycle: { ...doc.cycle, weeks },
  };
}

/** Switch the cycle on: `length` weeks, each starting as a copy of the program's own week. */
export function enableCycle(doc: CycleDoc, length: number = DEFAULT_CYCLE): CycleDoc {
  const len = Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, Math.round(length)));
  const base = weekOf(doc, 1);
  return {
    ...doc,
    cycle: { length: len, weeks: Array.from({ length: len - 1 }, () => copyOf(base)) },
  };
}

/** Switch the cycle off: only week 1 (the program's own days) stays. */
export function disableCycle(doc: CycleDoc): CycleDoc {
  const { cycle: _gone, ...rest } = doc;
  void _gone;
  return rest as CycleDoc;
}

/** More or fewer weeks: new weeks start as copies of week 1, removed weeks are cut from the end. */
export function resizeCycle(doc: CycleDoc, length: number): CycleDoc {
  const c = doc.cycle;
  if (!c) return doc;
  const len = Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, Math.round(length)));
  if (len === c.length) return doc;
  const base = weekOf(doc, 1);
  const weeks = c.weeks.slice(0, len - 1);
  while (weeks.length < len - 1) weeks.push(copyOf(base));
  return { ...doc, cycle: { ...c, length: len, weeks } };
}

/** The weeks that would be cut by shrinking to `length` and that hold any rows (so a confirm is worth asking). */
export function cutWeeksWithRows(doc: CycleDoc, length: number): number[] {
  const c = doc.cycle;
  if (!c || length >= c.length) return [];
  const out: number[] = [];
  for (let cw = length + 1; cw <= c.length; cw++)
    if (weekOf(doc, cw).items.length > 0) out.push(cw);
  return out;
}

/** Give a week its hint (or none). */
export function setWeekLabel(doc: CycleDoc, cw: number, label: CycleLabel | undefined): CycleDoc {
  const c = doc.cycle;
  if (!c || cw < 1 || cw > c.length) return doc;
  if (cw === 1) {
    const { baseLabel: _b, ...rest } = c;
    void _b;
    return { ...doc, cycle: { ...rest, ...(label ? { baseLabel: label } : {}) } };
  }
  const weeks = c.weeks.map((w, i) => {
    if (i !== cw - 2) return w;
    const { label: _l, ...rest } = w;
    void _l;
    return { ...rest, ...(label ? { label } : {}) };
  });
  return { ...doc, cycle: { ...c, weeks } };
}

/** Week `to` becomes a copy of week `from` (its days only; its hint stays). */
export function copyWeek(doc: CycleDoc, from: number, to: number): CycleDoc {
  const c = doc.cycle;
  if (!c || from === to || from < 1 || to < 1 || from > c.length || to > c.length) return doc;
  const src = copyOf(weekOf(doc, from));
  if (to === 1)
    return {
      ...doc,
      items: src.items as unknown as ProgramDoc['items'],
      dayNames: src.dayNames,
      targetMuscles: src.targetMuscles,
    };
  const weeks = c.weeks.map((w, i) => (i === to - 2 ? { ...w, ...src } : w));
  return { ...doc, cycle: { ...c, weeks } };
}
