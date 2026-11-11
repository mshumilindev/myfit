/**
 * Boot of the Planner chunk: puts its screen and its More row into the core's `plannerHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the add-on is installed.
 */
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { plannerHost } from '../plannerRt';
import { provide, trackerReady } from '../trackerRt';
import { PlannerPage } from './PlannerPage';
import { getPlans, getPrefs, startPlannerSync } from './sync';
import { STRINGS } from './strings';

provide(plannerHost, {
  Page: PlannerPage,
  exportFiles: () => [
    {
      name: 'planner-plans.json',
      about: 'Your Planner plans (title, note, icon, repeat, reminder).',
      content: { kind: 'json', value: getPlans() },
      rows: getPlans().length,
    },
    {
      name: 'planner-availability.json',
      about: 'Your weekly free hours and Planner defaults.',
      content: { kind: 'json', value: getPrefs() },
    },
  ],
  moreItem: (locale, open) => ({
    id: 'planner',
    icon: 'calendar-dots',
    label: STRINGS[locale].name,
    onSelect: open,
  }),
});
trackerReady('planner');

// The listeners follow the signed-in person.
let stop: (() => void) | undefined;
onAuthStateChanged(auth, (u) => {
  stop?.();
  stop = u ? startPlannerSync(u.uid) : undefined;
});
