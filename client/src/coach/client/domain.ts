/**
 * Pure rules of the client's sharing (S-26 .. S-34): the three presets, the six settings, what "Stop sharing" does.
 * Levels are the stored enum (off / effects / full); words are codes the UI localises.
 */
import { ALL_OFF } from '../domain/consent';
import type { Category, Consent, Level } from '../domain/types';

/** The six categories a client can give a trainer, in the order of the page. Check-ins are not a setting. */
export const SHARE_CATEGORIES = ['totals', 'sets', 'body', 'sleep', 'injury', 'nutrition'] as const;
export type ShareCategory = (typeof SHARE_CATEGORIES)[number];

export const CATEGORY_UI: Record<
  ShareCategory,
  { icon: string; tone: 'accent' | 'rest' | 'sleep' | 'injury' | 'kcal' }
> = {
  totals: { icon: 'barbell', tone: 'accent' },
  sets: { icon: 'list-checks', tone: 'accent' },
  body: { icon: 'scales', tone: 'rest' },
  sleep: { icon: 'moon', tone: 'sleep' },
  injury: { icon: 'first-aid-kit', tone: 'injury' },
  nutrition: { icon: 'fork-knife', tone: 'kcal' },
};
export const LEVEL_ICON: Record<Level, string> = {
  off: 'eye-slash',
  effects: 'sliders-horizontal',
  full: 'eye',
};

export type PresetId = 'training' | 'recovery' | 'all';
export const PRESET_IDS: readonly PresetId[] = ['training', 'recovery', 'all'];
export const PRESET_ICON: Record<PresetId, string> = {
  training: 'barbell',
  recovery: 'moon',
  all: 'eye',
};

/** Injuries and restrictions start Off in every preset (S-26). */
export function presetConsent(id: PresetId): Consent {
  const base = { ...ALL_OFF, checkins: 'full' as Level };
  if (id === 'training') return { ...base, totals: 'full', sets: 'full' };
  if (id === 'recovery')
    return { ...base, totals: 'full', sets: 'full', body: 'effects', sleep: 'effects' };
  return {
    ...base,
    totals: 'full',
    sets: 'full',
    body: 'full',
    sleep: 'full',
    nutrition: 'effects',
  };
}

export const NOTHING: Consent = { ...ALL_OFF };

export function levelsBy(c: Consent, level: Level): ShareCategory[] {
  return SHARE_CATEGORIES.filter((k) => c[k] === level);
}
export const sharedCount = (c: Consent): number =>
  SHARE_CATEGORIES.filter((k) => c[k] !== 'off').length;
export const sharesNothing = (c: Consent): boolean => sharedCount(c) === 0;

/** Stop sharing: every category goes off. */
export const revokedConsent = (): Consent => ({ ...ALL_OFF });

/** The consent that existed before a downgrade (kept 8 s for Undo). */
export const setLevelOf = (c: Consent, cat: Category, level: Level): Consent => ({
  ...c,
  [cat]: level,
});
