/** Human wording for the effects of long-term conditions (shared by the session, detail and coach views). */
import type { EffectLine } from './conditions';
import type { Strings } from './i18n/en';
import type { CardioCap } from './data/conditionCatalog';

export function effectText(l: EffectLine, t: Strings): string {
  const e = t.cndEffect;
  const tags = (l.tags ?? []).map((x) => t.cndTag[x] ?? x).join(', ');
  switch (l.id) {
    case 'avoid':
      return e.avoid(tags);
    case 'caution':
      return e.caution(tags);
    case 'muscleCap':
      return e.muscleCap(t.muscleGroups[l.muscle as string] ?? String(l.muscle), Number(l.value));
    case 'rpeMax':
      return e.rpeMax(Number(l.value));
    case 'volumeScale':
      return e.volumeScale(Number(l.value));
    case 'stepScale':
      return e.stepScale(Number(l.value));
    case 'cardioMax':
      return e.cardioMax(t.cndCardio[l.value as CardioCap]);
    case 'restScale':
      return e.restScale(Number(l.value));
    case 'noFailure':
      return e.noFailure;
    case 'noMaxEffort':
      return e.noMaxEffort;
    case 'noBreathHold':
      return e.noBreathHold;
    case 'noAutoIncrease':
      return e.noAutoIncrease;
  }
}
