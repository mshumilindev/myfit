/**
 * Per-account tweaks the owner asked for one person only (not a setting in the
 * UI). Keyed by the account's uid, so a name change doesn't break it.
 *
 * - `activityNames`: rename an activity type in every locale.
 * - `activityFirst`: activity types always offered first on Log activity
 *   (ahead of pins, first in their category).
 */
import type { LocaleId } from './i18n';

export interface AccountOverride {
  activityNames?: Record<string, Record<LocaleId, string>>;
  activityFirst?: string[];
}

export const ACCOUNT_OVERRIDES: Record<string, AccountOverride> = {
  // Valeriia Dmitriieva — plays table badminton, not court badminton.
  'dec4b283-ecd4-4e56-8f14-0a5da352f1a2': {
    activityNames: {
      badminton: {
        en: 'Table badminton',
        uk: 'Настільний бадмінтон',
        pl: 'Badminton stołowy',
        lt: 'Stalo badmintonas',
        et: 'Lauasulgpall',
      },
    },
    activityFirst: ['badminton'],
  },
};

let uid: string | null = null;
const listeners = new Set<() => void>();

/** Called on sign-in / sign-out. */
export function setOverrideUid(next: string | null): void {
  if (next === uid) return;
  uid = next;
  for (const l of listeners) l();
}

export function onOverrideChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The signed-in account's overrides (null for everyone else). */
export function accountOverride(): AccountOverride | null {
  return (uid && ACCOUNT_OVERRIDES[uid]) || null;
}

/** Types that must come first, then the rest in order, without duplicates. */
export function withFirst(keys: readonly string[]): string[] {
  const first = accountOverride()?.activityFirst ?? [];
  return [...first, ...keys.filter((k) => !first.includes(k))];
}

/** Stable sort that moves the account's "first" types to the front. */
export function firstOrder<T extends { key: string }>(items: readonly T[]): T[] {
  const first = accountOverride()?.activityFirst ?? [];
  if (!first.length) return [...items];
  const rank = (k: string) => {
    const i = first.indexOf(k);
    return i < 0 ? first.length : i;
  };
  return [...items].sort((a, b) => rank(a.key) - rank(b.key));
}
