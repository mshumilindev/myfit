/**
 * Localised condition names (uk/pl/lt/et), keyed by catalogue key. English stays in
 * conditionCatalog.ts and is the fallback. Each locale is its own chunk, loaded on
 * demand (`loadConditionNames`) and cached; until it arrives callers get English.
 */
import type { LocaleId } from '../i18n';

export interface ConditionNameEntry {
  name: string;
  aka?: string[];
}
type Table = Record<string, ConditionNameEntry>;
type NonEn = Exclude<LocaleId, 'en'>;

const LOADERS: Record<NonEn, () => Promise<{ default: Table }>> = {
  uk: () => import('./conditionNames/uk'),
  pl: () => import('./conditionNames/pl'),
  lt: () => import('./conditionNames/lt'),
  et: () => import('./conditionNames/et'),
};

const cache: Partial<Record<NonEn, Table>> = {};
const pending: Partial<Record<NonEn, Promise<void>>> = {};

/** Loads (once) the name table for a locale. Resolves immediately for English. */
export function loadConditionNames(locale: LocaleId): Promise<void> {
  if (locale === 'en' || cache[locale]) return Promise.resolve();
  return (pending[locale] ??= LOADERS[locale]()
    .then((m) => {
      cache[locale] = m.default;
    })
    .catch(() => {
      delete pending[locale];
    }));
}

export function conditionNamesLoaded(locale: LocaleId): boolean {
  return locale === 'en' || !!cache[locale];
}

/** The localised entry, or null (English, not loaded yet, or no translation). */
export function localizedCondition(key: string, locale: LocaleId): ConditionNameEntry | null {
  if (locale === 'en') return null;
  return cache[locale]?.[key] ?? null;
}
