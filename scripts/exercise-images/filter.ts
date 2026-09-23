/** CLI selection → the ordered list of work items. Pure, unit-tested. */
import type { CatalogExercise } from './catalog';
import type { ImageState } from './config';
import type { Manifest, Status } from './manifest';
import { entryKey } from './manifest';

export interface Selection {
  all?: boolean;
  pilot?: string[] | null;
  exercises?: string[];
  muscles?: string[];
  equipment?: string[];
  categories?: string[];
  statuses?: Status[];
  from?: number;
  limit?: number;
  states: ImageState[];
}

export interface WorkItem {
  exercise: CatalogExercise;
  state: ImageState;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Exercises are selected and ordered first (catalog order, or pilot order),
 * then --from / --limit slice EXERCISES — never split a start/end pair.
 */
export function selectExercises(
  catalog: CatalogExercise[],
  sel: Selection,
  manifest?: Manifest,
): CatalogExercise[] {
  let list = catalog;
  if (sel.pilot) {
    const byId = new Map(catalog.map((e) => [e.id, e]));
    list = sel.pilot.map((id) => byId.get(id)).filter((e): e is CatalogExercise => !!e);
  }
  if (sel.exercises?.length) {
    const want = new Set(sel.exercises.map(norm));
    list = list.filter((e) => want.has(norm(e.id)) || want.has(norm(e.slug)));
  }
  if (sel.muscles?.length) {
    const want = new Set(sel.muscles.map(norm));
    list = list.filter(
      (e) => (e.primary && want.has(norm(e.primary))) || want.has(norm(e.paletteKey)),
    );
  }
  if (sel.equipment?.length) {
    const want = new Set(sel.equipment.map(norm));
    list = list.filter((e) => want.has(norm(e.equipment ?? 'none')));
  }
  if (sel.categories?.length) {
    const want = new Set(sel.categories.map(norm));
    list = list.filter((e) => want.has(norm(e.category ?? 'none')));
  }
  if (sel.statuses?.length && manifest) {
    const want = new Set(sel.statuses);
    list = list.filter((e) =>
      sel.states.some((s) => {
        const en = manifest.entries[entryKey(e.id, s)];
        return want.has(en ? en.status : 'pending');
      }),
    );
  }
  const from = Math.max(0, sel.from ?? 0);
  const end = sel.limit !== undefined ? from + sel.limit : undefined;
  return list.slice(from, end);
}

/** A selection with no scoping flag at all must say --all explicitly. */
export function isScoped(sel: Selection): boolean {
  return !!(
    sel.all ||
    sel.pilot ||
    sel.exercises?.length ||
    sel.muscles?.length ||
    sel.equipment?.length ||
    sel.categories?.length ||
    sel.statuses?.length ||
    sel.limit !== undefined
  );
}

/** Items for the selected exercises; states the exercise has no reference for are dropped. */
export function toWorkItems(list: CatalogExercise[], states: ImageState[]): WorkItem[] {
  const out: WorkItem[] = [];
  for (const exercise of list) {
    for (const state of states) {
      if (exercise.references[state]) out.push({ exercise, state });
    }
  }
  return out;
}
