/**
 * Add-on registry (SPO-511). One entry per store item: an app (a whole area) or an add-on (a part of an app).
 * The store (`store-kit/`) and the shell read this list; features stay in the core until each one is stripped
 * into its own module (SPO-518/519). `roles` says who may see and enable the item — a role never sees the
 * rest, and `manager` has no store at all.
 */
import type { Role } from '../api';

export type StoreRole = Exclude<Role, 'manager'>;
export type AddonKind = 'app' | 'addon';
/** App colour family (design: add-ons inherit their parent's colour). */
export type AddonTone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface AddonManifest {
  id: string;
  kind: AddonKind;
  /** Parent app id for an add-on. Enabling the add-on enables the parent too. */
  parent?: string;
  tone: AddonTone;
  roles: readonly StoreRole[];
  /** Not available yet: shown under "Coming soon", never enabled. */
  soon?: boolean;
  category: 'recovery' | 'food' | 'insights' | 'look' | 'learn' | 'coach';
}

const ALL: readonly StoreRole[] = ['member', 'trainer', 'admin'];
const MEMBER: readonly StoreRole[] = ['member'];
const COACH: readonly StoreRole[] = ['trainer', 'admin'];

export const ADDONS: readonly AddonManifest[] = [
  { id: 'health', kind: 'app', tone: 4, roles: MEMBER, category: 'recovery' },
  {
    id: 'injury-log',
    kind: 'addon',
    parent: 'health',
    tone: 4,
    roles: MEMBER,
    category: 'recovery',
  },
  { id: 'cycle', kind: 'addon', parent: 'health', tone: 4, roles: MEMBER, category: 'recovery' },
  {
    id: 'supplements',
    kind: 'addon',
    parent: 'health',
    tone: 4,
    roles: MEMBER,
    category: 'recovery',
  },
  {
    id: 'nicotine-alcohol',
    kind: 'addon',
    parent: 'health',
    tone: 4,
    roles: MEMBER,
    category: 'recovery',
  },
  { id: 'sleep', kind: 'app', tone: 2, roles: MEMBER, category: 'recovery' },
  {
    id: 'sleep-auto-start',
    kind: 'addon',
    parent: 'sleep',
    tone: 2,
    roles: MEMBER,
    category: 'recovery',
  },
  {
    id: 'sleep-sounds',
    kind: 'addon',
    parent: 'sleep',
    tone: 2,
    roles: MEMBER,
    category: 'recovery',
  },
  { id: 'atlas', kind: 'app', tone: 6, roles: ALL, category: 'insights' },
  { id: 'mastery', kind: 'app', tone: 8, roles: MEMBER, category: 'insights' },
  { id: 'themes', kind: 'app', tone: 7, roles: ALL, category: 'look' },
  { id: 'exercise-media', kind: 'app', tone: 3, roles: ALL, category: 'look' },
  { id: 'learn', kind: 'app', tone: 1, roles: MEMBER, category: 'learn' },
  // Gyms is core for a member and an add-on for trainer and admin.
  { id: 'gyms', kind: 'addon', tone: 5, roles: COACH, category: 'coach' },
  // Not available yet (the store shows them as Coming soon).
  { id: 'nutrition', kind: 'app', tone: 0, roles: MEMBER, soon: true, category: 'food' },
  { id: 'music', kind: 'app', tone: 5, roles: MEMBER, soon: true, category: 'food' },
];

const BY_ID = new Map(ADDONS.map((a) => [a.id, a]));

export function addonById(id: string): AddonManifest | undefined {
  return BY_ID.get(id);
}
