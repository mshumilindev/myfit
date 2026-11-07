/**
 * What the Discover bento shows (SPO-500, design 01): pure picks from the role's catalog and the person's state.
 * No React, no storage — so every rule is testable.
 */
import type { Role } from '../api';
import { addonById, type AddonManifest } from '../addons/manifest';
import { isAddonAllowed } from '../addons/enabledSet';
import { recommend } from './recommend';
import { STORE_CATEGORIES, availableForRole } from './storeCatalog';

export interface DiscoverState {
  role: Role;
  enabled: ReadonlySet<string>;
  queued: readonly string[];
}

/** Starter packs: ids in order; only the ones the role may use. */
export const STARTER_PACKS = [{ id: 'recovery', ids: ['health', 'sleep'] }] as const;

/** The week number since 1970 (a Thursday-based week is fine: it only has to change once a week, the same for everyone). */
export function weekIndex(now: number): number {
  return Math.floor((now / 86_400_000 + 4) / 7);
}

/**
 * "App / Add-on of the week": one top-level item (an app, or an add-on that needs no other) the role can install, rotating
 * every week through the catalog in a fixed order. An installed item is skipped to the next; it stays while picked, so it
 * does not vanish after "Add". `now` is a parameter so the rule is testable.
 */
export function appOfTheWeek(
  { role, enabled }: DiscoverState,
  now: number = Date.now(),
): AddonManifest | null {
  const pool = availableForRole(role).filter(
    (m) => (m.kind === 'app' || (m.kind === 'addon' && !m.parent)) && isAddonAllowed(m.id, role),
  );
  if (!pool.length) return null;
  const start = weekIndex(now) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const m = pool[(start + i) % pool.length];
    if (!enabled.has(m.id)) return m;
  }
  return null;
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

/** Categories that hold at least one add-on this role can install, in store order (never a hard-coded count). */
export function addonCategories(role: Role): AddonManifest['category'][] {
  const used = new Set(
    availableForRole(role)
      .filter((m) => m.kind === 'addon')
      .map((m) => m.category),
  );
  return STORE_CATEGORIES.filter((c) => used.has(c));
}

export function categoryCount(role: Role): number {
  return addonCategories(role).length;
}

export type HeroMode = 'bento' | 'progress';

/** How much of the role's catalog is installed. */
export function catalogProgress(role: Role, enabled: ReadonlySet<string>) {
  // Looks are a collection of their own (their block in Discover), not part of "setting Spotter up".
  const all = availableForRole(role).filter((m) => m.kind !== 'theme');
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
