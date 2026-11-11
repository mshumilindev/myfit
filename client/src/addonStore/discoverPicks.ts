/**
 * What the Discover bento shows (SPO-500, design 01): pure picks from the role's catalog and the person's state.
 * No React, no storage — so every rule is testable.
 */
import { packsFor } from '../addons/starterPacks';
import type { Role } from '../api';
import { addonById, type AddonManifest } from '../addons/manifest';
import { isAddonAllowed } from '../addons/enabledSet';
import { recommend } from './recommend';
import { STORE_CATEGORIES, availableForRole, themesForRole } from './storeCatalog';

export interface DiscoverState {
  role: Role;
  enabled: ReadonlySet<string>;
  queued: readonly string[];
}

/** Starter packs: ids in order; only the ones the role may use. */
export const STARTER_PACKS = [{ id: 'recovery', ids: ['health', 'sleep'] }] as const;

/** The week number since 1970. Weeks turn over on Sunday 00:00 UTC (the epoch's day 3); it only has to change once a week, the same for everyone. */
export function weekIndex(now: number): number {
  return Math.floor((now / 86_400_000 + 4) / 7);
}

/** The three "of the week" slots; `mix` is the Discover tile (an app or a top-level add-on). */
export type WeekKind = 'app' | 'addon' | 'theme' | 'mix';

/** The pool a slot rotates through: everything of that kind the role can install, in catalog order (installs never move the cursor). */
export function weekPool(kind: WeekKind, role: Role): AddonManifest[] {
  if (kind === 'theme') return themesForRole(role);
  const all = availableForRole(role);
  if (kind === 'mix')
    return all.filter((m) => m.kind === 'app' || (m.kind === 'addon' && !m.parent));
  return all.filter((m) => m.kind === kind);
}

/** Holiday looks have a window: Halloween 24-31 Oct, Christmas 18 Dec - 1 Jan (local time). */
export function holidayOn(now: number): boolean {
  const d = new Date(now);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return (m === 10 && day >= 24) || (m === 12 && day >= 18) || (m === 1 && day <= 1);
}

/**
 * The pick of a slot: start at weekIndex % pool.length and take the first item that is not installed (a picked, still
 * queued item stays). Inside a holiday window an uninstalled Holiday pack is the Theme of the week. `now` is a
 * parameter so the rule is testable. Null when everything in the slot is installed.
 */
export function weekPick(
  kind: WeekKind,
  role: Role,
  enabled: ReadonlySet<string>,
  now: number = Date.now(),
): AddonManifest | null {
  const pool = weekPool(kind, role);
  if (!pool.length) return null;
  if (kind === 'theme' && holidayOn(now)) {
    const h = pool.find((m) => m.id === 'holiday-themes');
    if (h && !enabled.has(h.id)) return h;
  }
  const start = weekIndex(now) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const m = pool[(start + i) % pool.length];
    if (!enabled.has(m.id)) return m;
  }
  return null;
}

/** Discover's tile: the same rule over apps and top-level add-ons. */
export function appOfTheWeek(
  { role, enabled }: DiscoverState,
  now: number = Date.now(),
): AddonManifest | null {
  return weekPick('mix', role, enabled, now);
}

/** A starter pack still worth offering: the ids the role may use that are not installed (≥2 left). */
export function starterPack({ role, enabled }: DiscoverState) {
  // Coaches get their own set (Live, Notes, Gym...), the same one onboarding offers them; members get Recovery.
  const packs =
    role === 'member'
      ? STARTER_PACKS
      : packsFor(role)
          .filter((p) => p.id === 'coach')
          .map((p) => ({ id: p.id, ids: p.ids }));
  for (const p of packs) {
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
  // Looks count too (owner 10.11): "your Spotter" is everything the store offers this role, themes included.
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
