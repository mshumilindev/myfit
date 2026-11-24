import type { StoreState } from '../store';
import type { Strings } from '../i18n/en';
import type { TodayStrings } from '../today/strings';
import type { LocaleId } from '../i18n';

/** The part of a Today `WidgetCtx` the widget bodies read (declared here so neither the seam nor the chunk imports the Today registry, which would be a cycle). */
export interface FatigueWidgetCtx {
  store: StoreState;
  now: number;
  t: Strings;
  tw: TodayStrings;
  locale: LocaleId;
  shell: { goTab: (tab: 'progress') => void };
}
