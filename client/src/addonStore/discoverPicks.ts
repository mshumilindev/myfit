/**
 * What the Discover bento shows (SPO-500, design 01): pure picks from the role's catalog and the person's state.
 * No React, no storage — so every rule is testable.
 */
import type { Role } from '../api';
import { addonById, type AddonManifest } from '../addons/manifest';
import { isAddonAllowed } from '../addons/enabledSet';
import { recommend } from './recommend';
import { availableForRole, comingSoonForRole } from './storeCatalog';

export interface DiscoverState {
  role: Role;
  enabled: ReadonlySet<string>;
  queued: readonly string[];
}

/** Starter packs: ids in order; only the ones the role may use. */
export const STARTER_PACKS = [{ id: 'recovery', ids: ['health', 'injury-log', 'sleep'] }] as const;

/** "App of the week": the best app not yet installed — picked or not, so it stays after "Add". */
export function appOfTheWeek({ role, enabled }: DiscoverState): AddonManifest | null {
  const id = recommend(role, enabled, []).find((x) => addonById(x)?.kind === 'app');
  return id ? (addonById(id) ?? null) : null;
}

/** A starter pack still worth offering: the ids the role may use that are not installed (≥2 left). */
export function starterPack({ role, enabled }: DiscoverState) {
  for (const p of STARTER_PACKS) {
    const ids = p.ids.filter((x) => isAddonAllowed(x, role));
    const left = ids.filter((x) => !enabled.has(x));
    if (left.length >= 2) return { id: p.id, ids, left };
  }
  return null;
}

/** "Suggested because you use <App>": an add-on of an installed app, not yet installed. */
export function suggestion({
  role,
  enabled,
}: DiscoverState): { item: AddonManifest; parent: AddonManifest } | null {
  const id = recommend(role, enabled, []).find((x) => {
    const m = addonById(x);
    return !!m?.parent && enabled.has(m.parent);
  });
  const item = id ? addonById(id) : undefined;
  const parent = item?.parent ? addonById(item.parent) : undefined;
  return item && parent ? { item, parent } : null;
}

export function nextSoon(role: Role): AddonManifest | null {
  return comingSoonForRole(role)[0] ?? null;
}

export function categoryCount(role: Role): number {
  return new Set(availableForRole(role).map((m) => m.category)).size;
}

export type HeroMode = 'bento' | 'progress';

/** How much of the role's catalog is installed. */
export function catalogProgress(role: Role, enabled: ReadonlySet<string>) {
  const all = availableForRole(role);
  const done = all.filter((m) => enabled.has(m.id)).length;
  return { done, total: all.length, left: all.length - done };
}

/**
 * Bento or the progress hero (boards 22–24): the hero takes over once 70% of the catalog is installed or 3 or fewer
 * remain; the bento comes back only when 6 or more remain (in between, whatever was shown stays — no flicker).
 */
export function heroMode(
  prev: HeroMode,
  p: { done: number; total: number; left: number },
): HeroMode {
  if (p.total === 0) return 'bento';
  if (p.left <= 3 || p.done / p.total >= 0.7) return 'progress';
  if (p.left >= 6) return 'bento';
  return prev;
}

/** The hero's look: nothing left → complete, a few left → almost, otherwise plain progress. */
export function heroState(left: number): 'progress' | 'almost' | 'complete' {
  return left === 0 ? 'complete' : left <= 3 ? 'almost' : 'progress';
}
