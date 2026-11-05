/**
 * "Recommended for you" (SPO-500, design 28–29). A pure queue of the best next items for this person, recomputed
 * from what is already installed or picked, so it keeps refilling until the last item:
 *   1. add-ons of an app that is already installed or picked, in catalog order;
 *   2. apps by value for a new user (APP_ORDER), then add-ons of apps not yet picked are NOT listed (they need
 *      their app first);
 *   3. never: installed, picked, "coming soon", other roles' items, and `skip` (the App of the week).
 */
import type { Role } from '../api';
import { isAddonAllowed } from '../addons/enabledSet';
import { addonById } from '../addons/manifest';
import { availableForRole } from './storeCatalog';

export const APP_ORDER = [
  'health',
  'atlas',
  'sleep',
  'mastery',
  'themes',
  'exercise-media',
  'gyms',
];

export function recommend(
  role: Role,
  enabled: ReadonlySet<string>,
  queued: readonly string[],
  opts: { skip?: readonly string[]; limit?: number } = {},
): string[] {
  const have = new Set([...enabled, ...queued]);
  const skip = new Set(opts.skip ?? []);
  const pool = availableForRole(role).filter(
    (m) => isAddonAllowed(m.id, role) && !have.has(m.id) && !skip.has(m.id),
  );
  const addons = pool
    .filter((m) => m.kind === 'addon' && m.parent && have.has(m.parent))
    .map((m) => m.id);
  const apps = pool
    .filter((m) => m.kind === 'app' || !m.parent)
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((m) => m.id);
  const out = [...addons, ...apps].filter((id) => !!addonById(id));
  return typeof opts.limit === 'number' ? out.slice(0, opts.limit) : out;
}

function rank(id: string): number {
  const i = APP_ORDER.indexOf(id);
  return i === -1 ? APP_ORDER.length : i;
}
