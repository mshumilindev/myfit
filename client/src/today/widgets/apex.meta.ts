import { axs } from './apex.strings';
import { getLocale } from '../../i18n';
import type { WidgetMeta } from '../widgetMeta';

/**
 * Picker metadata of the Apex widgets (id, icon, tone, name) — light and eager; the render bodies live in `apex.tsx`,
 * a lazy chunk fetched only with Apex installed (SPO-500 I8). `apex.meta.test.ts` keeps this list equal to `apex.tsx`.
 */
export const APEX_WIDGET_META: WidgetMeta[] = [
  { id: 'streak', group: 'apex', icon: 'flame', tone: 'apex', name: (tw) => tw.streak },
  {
    id: 'apex-challenge',
    group: 'apex',
    icon: 'flag-banner',
    tone: 'apex',
    name: () => axs(getLocale()).nChallenge,
  },
  {
    id: 'apex-rank',
    group: 'apex',
    icon: 'trophy',
    tone: 'apex',
    name: () => axs(getLocale()).nRank,
  },
  {
    id: 'apex-awards',
    group: 'apex',
    icon: 'medal',
    tone: 'apex',
    name: () => axs(getLocale()).nAwards,
  },
  {
    id: 'apex-feed',
    group: 'apex',
    icon: 'bell',
    tone: 'apex',
    name: () => axs(getLocale()).nFeed,
  },
  {
    id: 'apex-mastery',
    group: 'apex',
    icon: 'shield-check',
    tone: 'apex',
    name: () => axs(getLocale()).nMastery,
  },
  {
    id: 'apex-level-up',
    group: 'apex',
    icon: 'arrow-fat-up',
    tone: 'apex',
    name: () => axs(getLocale()).nLevelUp,
  },
  {
    id: 'apex-next-feat',
    group: 'apex',
    icon: 'target',
    tone: 'apex',
    name: () => axs(getLocale()).nNextFeat,
  },
  {
    id: 'apex-feats-board',
    group: 'apex',
    icon: 'squares-four',
    tone: 'apex',
    name: () => axs(getLocale()).nFeatsBoard,
  },
  {
    id: 'apex-year-feats',
    group: 'apex',
    icon: 'calendar-check',
    tone: 'apex',
    name: () => axs(getLocale()).nYearFeats,
  },
];
