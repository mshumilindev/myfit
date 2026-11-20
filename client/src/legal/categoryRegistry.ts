/**
 * The one registry of consent categories (SPO-571): who owns each category (an add-on, or the core app), which consent
 * kind and trainer-sharing setting it has, and how it looks on the consent surfaces. Pure: no React, no store.
 *
 * Rule (legal-compliance.md): a consent exists only for what is installed. A row is shown when its owner is available
 * (`addonAvailable` semantics: installed, or base for the role, or a "coming soon" app that cannot be installed yet, so a
 * consent for a feature that may already hold data is never hidden). History of records is never filtered by owner.
 * A new consent kind or sharing setting without an entry here fails `categoryRegistry.test.ts`.
 */
import type { Tone } from '../components/ui/tones';
import type { ConsentKind, HealthFeature } from './consents';

/** The owner of categories that belong to the base app. */
export const CORE_OWNER = 'core';

export type OnRemove = 'withdraw' | 'keep';

export interface CategoryEntry {
  id: string;
  /** Manifest id of the add-on or app that uses the data, or `CORE_OWNER`. */
  owner: string;
  /** The consent that lets the owner process this category; absent when sharing alone is the setting. */
  consent?: ConsentKind;
  /** The trainer-sharing setting (`coach/client/shareModel` ShareId), or `'none'`: this category is never shared. */
  share: string;
  /** What happens to the consent when the owner is removed. `keep`: the person decides (saved chat copy). */
  onRemove: OnRemove;
  /** Look on the consent surfaces (drawer and Consents page). */
  icon?: string;
  tone?: Tone;
}

export const CATEGORY_REGISTRY: readonly CategoryEntry[] = [
  {
    id: 'injuries',
    owner: 'injury-log',
    consent: 'health:injuries',
    share: 'injury',
    onRemove: 'withdraw',
    icon: 'bandaids',
    tone: 'injury',
  },
  {
    id: 'chronic',
    owner: 'conditions',
    consent: 'health:chronic',
    share: 'conditions',
    onRemove: 'withdraw',
    icon: 'heartbeat',
    tone: 'chronic',
  },
  {
    id: 'cycle',
    owner: 'cycle',
    consent: 'health:cycle',
    share: 'none',
    onRemove: 'withdraw',
    icon: 'drop',
    tone: 'apex',
  },
  {
    id: 'nicotine',
    owner: 'nicotine',
    consent: 'health:nicotine',
    share: 'nicotine',
    onRemove: 'withdraw',
    icon: 'flame',
    tone: 'illness',
  },
  {
    id: 'alcohol',
    owner: 'alcohol',
    consent: 'health:alcohol',
    share: 'alcohol',
    onRemove: 'withdraw',
    icon: 'wine',
    tone: 'kcal',
  },
  {
    id: 'supplements',
    owner: 'supplements',
    consent: 'health:supplements',
    share: 'supplements',
    onRemove: 'withdraw',
    icon: 'pill',
    tone: 'accent',
  },
  {
    id: 'nutrition',
    owner: 'nutrition',
    consent: 'health:nutrition',
    share: 'nutrition',
    onRemove: 'withdraw',
    icon: 'fork-knife',
    tone: 'ok',
  },
  {
    id: 'atlas-ai',
    owner: 'atlas',
    consent: 'atlas-ai',
    share: 'none',
    onRemove: 'withdraw',
    icon: 'sparkle',
    tone: 'atlas',
  },
  {
    id: 'atlas-puter',
    owner: 'atlas',
    consent: 'atlas-puter',
    share: 'none',
    onRemove: 'withdraw',
    icon: 'sparkle',
    tone: 'atlas',
  },
  {
    id: 'atlas-history',
    owner: 'atlas',
    consent: 'atlas-history',
    share: 'none',
    onRemove: 'keep',
    icon: 'chats-circle',
    tone: 'atlas',
  },
  {
    id: 'geo-search',
    owner: 'gym',
    consent: 'geo-search',
    share: 'none',
    onRemove: 'withdraw',
    icon: 'map-pin',
    tone: 'accent',
  },
  // Sharing-only settings (no consent of their own).
  { id: 'sleep', owner: 'sleep', share: 'sleep', onRemove: 'keep' },
  { id: 'availability', owner: 'planner', share: 'availability', onRemove: 'keep' },
  { id: 'body', owner: CORE_OWNER, share: 'body', onRemove: 'keep' },
  { id: 'totals', owner: CORE_OWNER, share: 'totals', onRemove: 'keep' },
  { id: 'sets', owner: CORE_OWNER, share: 'sets', onRemove: 'keep' },
];

const BY_CONSENT = new Map<ConsentKind, CategoryEntry>(
  CATEGORY_REGISTRY.flatMap((e) => (e.consent ? [[e.consent, e] as const] : [])),
);

export const categoryOfConsent = (kind: ConsentKind): CategoryEntry | undefined =>
  BY_CONSENT.get(kind);

export const categoryOfHealth = (f: HealthFeature): CategoryEntry =>
  BY_CONSENT.get(`health:${f}`) as CategoryEntry;

/**
 * Is the consent row for `kind` shown: its owner is the core, or `available(owner)` (the app's own gate:
 * `useAddonAvailable()` in a component, `addonAvailable` in pure code). A kind the registry does not know stays visible
 * (fail open for display: a consent is never hidden by a gap here; the guard test keeps the registry complete).
 */
export function consentVisible(kind: ConsentKind, available: (id: string) => boolean): boolean {
  const e = BY_CONSENT.get(kind);
  return !e || e.owner === CORE_OWNER || available(e.owner);
}
