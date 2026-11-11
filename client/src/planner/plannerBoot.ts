/**
 * Boot of the Planner chunk: puts its screen and its More row into the core's `plannerHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the add-on is installed.
 */
import { plannerHost } from '../plannerRt';
import { provide, trackerReady } from '../trackerRt';
import { PlannerPage } from './PlannerPage';
import { STRINGS } from './strings';

provide(plannerHost, {
  Page: PlannerPage,
  moreItem: (locale, open) => ({
    id: 'planner',
    icon: 'calendar-dots',
    label: STRINGS[locale].name,
    onSelect: open,
  }),
});
trackerReady('planner');
