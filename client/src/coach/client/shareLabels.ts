/** Title, icon, tone and "what a coach sees" lines of each of the ten sharing settings (words from the two dictionaries). */
import type { Tone } from '../../components/ui/tones';
import { FEATURE_ICON } from '../../coachEffectIcons';
import type { Strings } from '../../i18n/en';
import type { ClientStrings } from '../../i18n/coachClient';
import type { Level } from '../domain/types';
import { CATEGORY_UI } from './domain';
import { catTitle, seesText } from './labels';
import { isLocalCategory, type ShareId } from './shareModel';

export interface ShareRowMeta {
  title: string;
  icon: string;
  tone: Tone;
  /** Plain-words example per level; a level the setting does not offer is absent. */
  sees: Partial<Record<Level, string>>;
}

export function shareRowMeta(id: ShareId, cc: ClientStrings, t: Strings): ShareRowMeta {
  if (!isLocalCategory(id)) {
    const ui = CATEGORY_UI[id];
    return {
      title: catTitle(cc, id),
      icon: ui.icon,
      tone: ui.tone,
      sees: {
        off: seesText(cc, id, 'off'),
        effects: seesText(cc, id, 'effects'),
        full: seesText(cc, id, 'full'),
      },
    };
  }
  switch (id) {
    case 'conditions':
      return {
        title: t.cndTitle,
        icon: FEATURE_ICON.conditions,
        tone: 'chronic',
        sees: { off: t.cndShareHintOff, effects: t.cndShareHintEffects, full: t.cndShareHintFull },
      };
    case 'nicotine':
      return {
        title: t.nicTitle,
        icon: FEATURE_ICON.nicotine,
        tone: 'accent',
        sees: { off: t.nicPrivSeeOff, effects: t.nicPrivSeeEffects, full: t.nicPrivSeeFull },
      };
    case 'alcohol':
      return {
        title: t.alcTitle,
        icon: FEATURE_ICON.alcohol,
        tone: 'accent',
        sees: { off: t.nicPrivSeeOff, effects: t.alcPrivSeeEffects },
      };
    case 'supplements':
      return {
        title: t.supTitle,
        icon: FEATURE_ICON.supplements,
        tone: 'accent',
        sees: { off: t.nicPrivSeeOff, effects: t.supPrivSeeEffects, full: t.supPrivSeeFull },
      };
  }
}
