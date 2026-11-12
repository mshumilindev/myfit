/**
 * Boot of the Planner chunk: puts its screen and its More row into the core's `plannerHost` and announces it is ready.
 * Imported lazily (and only) by `addons/useAddonRuntime.ts` while the add-on is installed.
 */
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { addonsPref } from '../addons/enabledSet';
import { plannerAvailabilityAvailable } from '../addons/featureGates';
import { plannerHost, setPlannerShareMirror } from '../plannerRt';
import { healthAddonInstalled, restPeriodShown } from '../healthAddons';
import { getStoreState, subscribeStore } from '../store';
import { buildCoachAvailability } from './coachView';
import { provide, trackerReady } from '../trackerRt';
// Every add-on's "Based on" source: one file each in plannerSources/, picked up here (no list to edit).
import.meta.glob('../plannerSources/*.tsx', { eager: true });
import { PlannerPage } from './PlannerPage';
import { RingLayer } from './RingLayer';
import { UpNext } from './UpNext';
import { startAlertsSync } from './alertsSync';
import { getPlans, getPrefs, savePrefs, startPlannerSync, subscribePlanner } from './sync';
import { STRINGS } from './strings';

const sharedPrefs = () => {
  const p = getPrefs();
  return plannerAvailabilityAvailable() ? p : { ...p, shareAvailability: false };
};

const coachView = () =>
  buildCoachAvailability(
    sharedPrefs(),
    getStoreState().restPeriods,
    Math.floor(Date.now() / 86_400_000),
    restPeriodShown,
    healthAddonInstalled('injury-log') ? getStoreState().injuries : [],
  );

provide(plannerHost, {
  Page: PlannerPage,
  coachView,
  setShare: (on) => void savePrefs({ ...getPrefs(), shareAvailability: on }),
  Layer: RingLayer,
  UpNext,
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

// What a trainer sees follows the person's choice and their hours (and the Health states behind "not available"): when any of
// it changes, the coach view is republished. The core mirrors only the on/off setting, for its sharing list.
let seen = '';
const follow = () => {
  setPlannerShareMirror(sharedPrefs().shareAvailability === true);
  const sig = JSON.stringify(coachView());
  if (sig === seen) return;
  seen = sig;
  trackerReady('planner'); // the store listens to it: re-publishes what the coach sees
};
subscribePlanner(follow);
subscribeStore(follow);
addonsPref.subscribe(follow);
follow();

// The listeners follow the signed-in person.
let stop: (() => void) | undefined;
onAuthStateChanged(auth, (u) => {
  stop?.();
  if (!u) {
    stop = undefined;
    return;
  }
  const stopPlans = startPlannerSync(u.uid);
  const stopAlerts = startAlertsSync(u.uid);
  stop = () => {
    stopPlans();
    stopAlerts();
  };
});
