/**
 * Add-on registry (SPO-511). One entry per store item. Owner rule (10.11): the apps are Gym, Apex, Coach, plus Nutrition
 * and Music (coming soon). Users and Learn are not apps or add-ons. Everything else in the store — Health, Sleep, Activities,
 * Home workouts, Goals, Playbook, Atlas and the Coach extras (Live, Signals, Notes, Team) — is an add-on (Mastery is a module of Apex); looks are single `theme` items.
 * `parent` is a dependency (enabling the item enables its parent), not a claim that the parent is an app.
 * The store (`store-kit/`) and the shell read this list; features stay in the core until each one is stripped
 * into its own module (SPO-518/519). `roles` says who may see and enable the item — a role never sees the
 * rest, and `manager` has no store at all.
 */
import type { Role } from '../api';

export type StoreRole = Exclude<Role, 'manager'>;
/** `theme` = an installable look (Cyberpunk…) or the whole set of holiday themes: its own store block and tab; only Brass Glass is base. */
/** `module` = a switch inside its parent (Health's Injury log…): never a store item of its own, only toggled in Configure. */
export type AddonKind = 'app' | 'addon' | 'theme' | 'module';
/** App colour family (design: add-ons inherit their parent's colour). */
export type AddonTone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface AddonManifest {
  id: string;
  kind: AddonKind;
  /** For `kind: 'theme'`: the id in themes/registry.ts this item unlocks. */
  themeId?: string;
  /** For `kind: 'theme'` that unlocks several looks at once (the holiday themes): their ids in themes/registry.ts. */
  themeIds?: readonly string[];
  /** Parent app id for an add-on. Enabling the add-on enables the parent too. */
  parent?: string;
  /**
   * An app this item cannot work without (owner rule 07.11: everything that depends on Gym is blocked until Gym is
   * installed). Unlike `parent` it is never installed for the person: the item stays locked until the app is there,
   * and removing the app removes the item.
   */
  requires?: string;
  /**
   * Roles for whom the item is part of the base: always on, not in the store, cannot be removed. When it is set it is
   * the whole answer (a role outside it, and outside `roles`, never has the item). `manager` is not a store role.
   */
  baseFor?: readonly (StoreRole | 'manager')[];
  tone: AddonTone;
  roles: readonly StoreRole[];
  /** Not available yet: shown under "Coming soon", never enabled. */
  soon?: boolean;
  category: 'health' | 'workouts' | 'recovery' | 'food' | 'insights' | 'look' | 'coach';
  /** Built chunk URLs kept offline on install (prefetch.ts). Empty until the add-on is split out of the core bundle. */
  chunks?: readonly string[];
  /** Rough download size in bytes, for the storage-quota check. */
  sizeHint?: number;
}

const ALL: readonly StoreRole[] = ['member', 'trainer', 'admin'];
const COACHES: readonly StoreRole[] = ['trainer', 'admin'];

export const ADDONS: readonly AddonManifest[] = [
  { id: 'health', kind: 'addon', requires: 'gym', tone: 4, roles: ALL, category: 'health' },
  {
    id: 'injury-log',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  {
    id: 'rest',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  {
    id: 'unwell',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  {
    id: 'conditions',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  { id: 'cycle', kind: 'module', parent: 'health', tone: 4, roles: ALL, category: 'health' },
  {
    id: 'supplements',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  {
    id: 'nicotine',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  {
    id: 'alcohol',
    kind: 'module',
    parent: 'health',
    tone: 4,
    roles: ALL,
    category: 'health',
  },
  { id: 'sleep', kind: 'addon', requires: 'gym', tone: 2, roles: ALL, category: 'recovery' },
  { id: 'activities', kind: 'addon', requires: 'gym', tone: 9, roles: ALL, category: 'workouts' },
  { id: 'home-sets', kind: 'addon', requires: 'gym', tone: 3, roles: ALL, category: 'workouts' },
  { id: 'goals', kind: 'addon', requires: 'gym', tone: 5, roles: ALL, category: 'workouts' },
  { id: 'playbook', kind: 'addon', requires: 'gym', tone: 7, roles: ALL, category: 'workouts' },
  { id: 'atlas', kind: 'addon', requires: 'gym', tone: 6, roles: ALL, category: 'insights' },
  { id: 'apex', kind: 'app', requires: 'gym', tone: 8, roles: ALL, category: 'insights' },
  // Apex's own parts are modules of it (owner rule 07.11): switched on with Apex, each one off in Configure.
  {
    id: 'apex-challenges',
    kind: 'module',
    parent: 'apex',
    tone: 8,
    roles: ALL,
    category: 'insights',
  },
  { id: 'apex-ranks', kind: 'module', parent: 'apex', tone: 8, roles: ALL, category: 'insights' },
  { id: 'apex-awards', kind: 'module', parent: 'apex', tone: 8, roles: ALL, category: 'insights' },
  { id: 'mastery', kind: 'module', parent: 'apex', tone: 8, roles: ALL, category: 'insights' },
  // Themes are installed one by one (owner rule 06.11): only Brass Glass is part of the base. The holiday themes
  // (Halloween, Christmas…) are ONE item (owner 08.11): they put themselves on around their holiday once it is installed.
  // Brass Glass is an add-on too (owner 08.11) and is installed for everyone by default (`migrateBrassGlass`), so nothing
  // changes for anyone. The app still wears it when no look is installed: it is the fallback until the new base look lands.
  {
    id: 'theme-brass-glass',
    kind: 'theme',
    themeId: 'glass',
    tone: 7,
    roles: ALL,
    category: 'look',
  },
  {
    id: 'theme-cyberpunk',
    kind: 'theme',
    themeId: 'cyberpunk',
    tone: 7,
    roles: ALL,
    category: 'look',
  },
  {
    id: 'holiday-themes',
    kind: 'theme',
    themeIds: ['halloween', 'christmas'],
    tone: 5,
    roles: ALL,
    category: 'look',
  },
  // Gym is the base of a member (not in the store, cannot be removed) and an app a trainer or an admin installs.
  // Coach is the base of a trainer (and of a manager, who has no store) and an app an admin installs.
  {
    id: 'gym',
    kind: 'app',
    tone: 1,
    roles: ['trainer', 'admin'],
    baseFor: ['member'],
    category: 'workouts',
  },
  {
    id: 'coach',
    kind: 'app',
    tone: 6,
    roles: ['admin'],
    baseFor: ['trainer', 'manager'],
    category: 'coach',
  },
  // Coach extras (owner 08.11): the base Coach is clients, chat, agenda, decisions, schedule, week and programs.
  {
    id: 'coach-live',
    kind: 'addon',
    requires: 'coach',
    // A member never opens the coach screens; they only see what a trainer shared (notes), so for them it is never gated.
    baseFor: ['member'],
    tone: 6,
    roles: COACHES,
    category: 'coach',
  },
  {
    id: 'coach-signals',
    kind: 'addon',
    requires: 'coach',
    // A member never opens the coach screens; they only see what a trainer shared (notes), so for them it is never gated.
    baseFor: ['member'],
    tone: 6,
    roles: COACHES,
    category: 'coach',
  },
  {
    id: 'coach-notes',
    kind: 'addon',
    requires: 'coach',
    // A member never opens the coach screens; they only see what a trainer shared (notes), so for them it is never gated.
    baseFor: ['member', 'manager'], // a manager keeps the notes on the team's clients
    tone: 6,
    roles: COACHES,
    category: 'coach',
  },
  {
    id: 'coach-team',
    kind: 'addon',
    requires: 'coach',
    tone: 6,
    roles: COACHES,
    baseFor: ['member', 'manager'],
    category: 'coach',
  },
  // Not available yet (the store shows them as Coming soon).
  { id: 'nutrition', kind: 'app', tone: 0, roles: ALL, soon: true, category: 'food' },
  { id: 'music', kind: 'app', tone: 5, roles: ALL, soon: true, category: 'food' },
];

const BY_ID = new Map(ADDONS.map((a) => [a.id, a]));

export function addonById(id: string): AddonManifest | undefined {
  return BY_ID.get(id);
}

/**
 * The app an item belongs to: its `parent`, or the app it `requires` (owner rule 11.11: everything that depends on an app
 * counts as that app's, always and everywhere — Coach extras and Gym extras alike). An app never belongs to another app
 * (Apex requires Gym but stays an app of its own). Computed from the registry, never listed by hand: a new item with
 * `parent`/`requires` joins its app's counts, lists, Installed card and Remove sheet by itself.
 */
export function appOfItem(
  m: AddonManifest,
  byId: ReadonlyMap<string, AddonManifest> = BY_ID,
): string | undefined {
  if (m.parent) return m.parent;
  if (!m.requires || m.kind === 'app') return undefined;
  const r = byId.get(m.requires);
  return r?.kind === 'app' ? r.id : undefined;
}

/** Add-ons and modules that belong to an app (by `parent` or by the app they require). */
export function itemsOfApp(id: string, list: readonly AddonManifest[] = ADDONS): AddonManifest[] {
  const byId = list === ADDONS ? BY_ID : new Map(list.map((a) => [a.id, a]));
  return list.filter((a) => appOfItem(a, byId) === id);
}
