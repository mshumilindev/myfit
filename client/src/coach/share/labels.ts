/**
 * Words for a resolved share: titles, sub lines, chips, facts, reasons, search strings. Pure functions over the
 * dictionaries, so the card, the picker row and the peek say the same thing in the reader's language.
 */
import { exerciseDisplay } from '../../data/exerciseNames';
import { equipCategoryLabel } from '../../data/equipmentI18n';
import type { EquipCategory } from '../../data/equipmentCatalog';
import type { LocaleId } from '../../i18n';
import type { useT } from '../../i18n';
import type { ShareStrings } from '../../i18n/coachShare';
import { coachDate } from '../format';
import type { Dow } from '../domain/types';
import type { FamilyId, ShareFact, ShareReason, ShareRow, ShareSub, ShareView } from './types';

export interface Words {
  sh: ShareStrings;
  t: ReturnType<typeof useT>['t'];
  locale: LocaleId;
}

const DOW_INDEX: Record<Dow, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
/** "Tue" -> the reader's short weekday ("вт", "Tue"). 5 Oct 2026 is a Monday. */
export function dowLabel(d: Dow, locale: LocaleId): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 9, 5 + DOW_INDEX[d], 12)),
  );
}

export const muscleName = (w: Words, id: string): string => w.t.muscleGroups[id] ?? id;
export const equipName = (w: Words, id: string): string =>
  (w.sh.equipment as Record<string, string | undefined>)[id] ??
  (w.t.equipmentNames as Record<string, string | undefined> | undefined)?.[id] ??
  id;
export const amenityName = (w: Words, id: string): string =>
  (w.t as unknown as Record<string, string>)[`amen_${id}`] ?? id;
export const familyName = (w: Words, id: FamilyId): string =>
  id === 'other' ? w.sh.equipment.other : (w.t.pickFamilies[id] ?? id);

export function titleOf(w: Words, v: ShareView): string {
  if (v.state === 'removed') return w.sh.removed[v.kind];
  if (!v.title) return w.sh.kind[v.kind];
  if (v.kind === 'muscle') return muscleName(w, v.title);
  if (v.kind === 'activity') return (w.t.actType as Record<string, string>)[v.title] ?? v.title;
  if (v.exerciseName) return exerciseDisplay(v.title, w.locale).primary;
  return v.title;
}

export function subOf(w: Words, s: ShareSub | undefined): string | undefined {
  if (!s) return undefined;
  switch (s.k) {
    case 'program':
      return w.sh.subProgram(s.weeks, s.days);
    case 'day':
      return w.sh.subDay(s.program, s.wd ? dowLabel(s.wd, w.locale) : undefined);
    case 'text':
      return s.text;
    case 'family':
      return familyName(w, s.id);
    case 'equipCat':
      return equipCategoryLabel(s.id as EquipCategory, w.locale);
    case 'workout':
      return s.gym ? `${coachDate(s.at, w.locale)} · ${s.gym}` : coachDate(s.at, w.locale);
    case 'date':
      return coachDate(s.at, w.locale);
    case 'results':
      return w.sh.subResults(s.who);
    case 'muscle':
      return s.you ? w.sh.subMuscleYou : s.who ? w.sh.subMuscleWho(s.who) : w.sh.subMuscle;
  }
}

export function chipsOf(w: Words, v: ShareView): string[] | undefined {
  if (!v.chips) return undefined;
  if (v.chipsAreMuscles) return v.chips.map((m) => muscleName(w, m));
  if (v.kind === 'gym') return v.chips.map((a) => amenityName(w, a));
  return v.chips;
}

export function factOf(w: Words, f: ShareFact): { label: string; value: string } {
  let label = w.sh.fact[f.key];
  if (f.key === 'best' && f.who) label = w.sh.bestOf(f.who);
  let value: string;
  if (f.list === 'equipmentIds')
    value = String(f.value)
      .split(',')
      .map((id) => equipName(w, id))
      .join(', ');
  else if (f.key === 'effort')
    value = w.sh.effort[f.value as 'light' | 'moderate' | 'hard'] ?? String(f.value);
  else if (f.key === 'dayType') value = w.sh.dayTypeMuscles;
  else if (f.key === 'change' && typeof f.value === 'number')
    value =
      Math.abs(f.value) < 2.5
        ? w.sh.noClearChange
        : `${f.value > 0 ? '+' : '−'}${w.sh.unit.kg(Math.abs(f.value))}`;
  else if (f.unit) value = w.sh.unit[f.unit](f.value);
  else value = String(f.value);
  return { label, value };
}

export function rowMeta(w: Words, r: ShareRow): string | undefined {
  if (r.top) return r.top;
  if (r.sets !== undefined || r.bare)
    return r.bare ? w.sh.rowJust : w.sh.rowSets(r.sets ?? 0, r.reps, r.kg);
  return undefined;
}

export function reasonOf(w: Words, v: ShareView, clientName?: string): string | undefined {
  const r: ShareReason | undefined = v.reason;
  if (!r) return undefined;
  const who = v.who ?? clientName ?? w.sh.clientWord;
  switch (r.code) {
    case 'notAssigned':
      return w.sh.reasonNotAssigned;
    case 'ownerDeleted':
      return w.sh.reasonOwnerDeleted;
    case 'notInLibrary':
      return w.sh.reasonNotInLibrary;
    case 'notInHistory':
      return w.sh.reasonNotInHistory;
    case 'private':
      return w.sh.reasonPrivate;
    case 'notShared':
      return w.sh.reasonNotShared(who, w.sh.catWords[r.cat]);
    case 'fewSessions':
      return w.sh.reasonFewSessions;
  }
}

/** Everything a search may match on, in the reader's language (the engine does not know the dictionary). */
export function searchLabels(w: Words, v: ShareView): { title: string; extra: string[] } {
  return {
    title: titleOf(w, v),
    extra: [subOf(w, v.sub) ?? '', ...(chipsOf(w, v) ?? [])].filter(Boolean),
  };
}
