/** Words for the client-side trainer screens: categories, levels, presets, access-log lines. Pure lookups over the dictionary. */
import type { Level } from '../domain/types';
import type { ClientStrings } from '../../i18n/coachClient';
import type { AccessWhat } from './data/types';
import type { PresetId, ShareCategory } from './domain';

export const catTitle = (cc: ClientStrings, k: ShareCategory): string =>
  ({
    totals: cc.catTotals,
    sets: cc.catSets,
    body: cc.catBody,
    sleep: cc.catSleep,
    injury: cc.catInjury,
    nutrition: cc.catNutrition,
  })[k];

export const levelWord = (cc: ClientStrings, l: Level): string =>
  l === 'full' ? cc.lvFull : l === 'effects' ? cc.lvEffects : cc.lvOff;

export function seesText(cc: ClientStrings, k: ShareCategory, l: Level): string {
  const t = {
    totals: [cc.seesTotalsOff, cc.seesTotalsEffects, cc.seesTotalsFull],
    sets: [cc.seesSetsOff, cc.seesSetsEffects, cc.seesSetsFull],
    body: [cc.seesBodyOff, cc.seesBodyEffects, cc.seesBodyFull],
    sleep: [cc.seesSleepOff, cc.seesSleepEffects, cc.seesSleepFull],
    injury: [cc.seesInjuryOff, cc.seesInjuryEffects, cc.seesInjuryFull],
    nutrition: [cc.seesNutritionOff, cc.seesNutritionEffects, cc.seesNutritionFull],
  }[k];
  return t[l === 'off' ? 0 : l === 'effects' ? 1 : 2];
}

export const presetTitle = (cc: ClientStrings, id: PresetId): string =>
  id === 'training' ? cc.presetTraining : id === 'recovery' ? cc.presetRecovery : cc.presetAll;
export const presetSub = (cc: ClientStrings, id: PresetId): string =>
  id === 'training'
    ? cc.presetTrainingSub
    : id === 'recovery'
      ? cc.presetRecoverySub
      : cc.presetAllSub;

export const accessText = (cc: ClientStrings, w: AccessWhat): string =>
  w === 'week'
    ? cc.lgWeek
    : w === 'session'
      ? cc.lgSession
      : w === 'history'
        ? cc.lgHistory
        : w === 'live'
          ? cc.lgLive
          : cc.lgSummary;

/** "A, B and C" with the dictionary-free joiner of the active locale. */
export function listWords(names: readonly string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/** "2 Jun 2026" in the locale (the trainer-since line). */
export const sinceDate = (ts: number, locale: string): string =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts));
