/**
 * Today widget registry — every widget the user can put in a section.
 * A widget renders itself in any of the four sizes (S · M · L · XL); the slot
 * of its section decides which. Widgets read the app's real data through ctx.
 *
 * The full catalogue (115 widgets, design page "Бібліотека віджетів") lands in
 * groups; each group registers here.
 */
import type { ReactNode } from 'react';
import { useAddonAvailable } from '../addons/enabledSet';
import type { WidgetSize } from '../components/ui/Widget';
import type { Tone } from '../components/ui/tones';
import type { Shell } from '../App';
import type { StoreState } from '../store';
import type { Strings } from '../i18n/en';
import type { LocaleId } from '../i18n';
import type { TodayStrings } from './strings';
import { BODY_WIDGETS } from './widgets/body';
import { TRAINING_WIDGETS } from './widgets/training';
import { APEX_WIDGETS } from './widgets/apex';
import { BODY_PLUS_WIDGETS } from './widgets/bodyplus';
import { LEARN_ATLAS_WIDGETS } from './widgets/learnatlas';
import { DISCOVER_WIDGETS } from './widgets/discover';
import { PLAN_WIDGETS } from './widgets/plan';
import { STRENGTH_WIDGETS } from './widgets/strength';
import { MUSCLES_WIDGETS } from './widgets/muscles';
import { CARDIO_WIDGETS } from './widgets/cardio';
import { FUN_WIDGETS } from './widgets/fun';
import { CALENDAR_WIDGETS } from './widgets/calendar';
import { CYCLE_WIDGETS } from './widgets/cycle';

export interface WidgetCtx {
  store: StoreState;
  now: number;
  t: Strings;
  tw: TodayStrings;
  locale: LocaleId;
  shell: Shell;
  /** Open the weigh-in sheet on Today. */
  openWeight: () => void;
}

export type WidgetGroup =
  | 'training'
  | 'plan'
  | 'strength'
  | 'muscles'
  | 'body'
  | 'cardio'
  | 'apex'
  | 'learn'
  | 'atlas'
  | 'discover'
  | 'fun'
  | 'calendar';

/** Display order of the groups in pickers and the library. */
export const WIDGET_GROUPS: WidgetGroup[] = [
  'training',
  'plan',
  'strength',
  'muscles',
  'body',
  'cardio',
  'apex',
  'learn',
  'atlas',
  'discover',
  'fun',
  'calendar',
];

export interface WidgetDef {
  id: string;
  group: WidgetGroup;
  icon: string;
  tone: Tone;
  /** Picker label. */
  name: (tw: TodayStrings) => string;
  render: (size: WidgetSize, ctx: WidgetCtx) => ReactNode;
}

const ALL: WidgetDef[] = [
  ...TRAINING_WIDGETS,
  ...PLAN_WIDGETS,
  ...STRENGTH_WIDGETS,
  ...MUSCLES_WIDGETS,
  ...BODY_WIDGETS,
  ...BODY_PLUS_WIDGETS,
  ...CARDIO_WIDGETS,
  ...APEX_WIDGETS,
  ...LEARN_ATLAS_WIDGETS,
  ...DISCOVER_WIDGETS,
  ...FUN_WIDGETS,
  ...CALENDAR_WIDGETS,
  ...CYCLE_WIDGETS,
];
/** Every widget, ordered by group (stable within a group). */
export const WIDGETS: WidgetDef[] = WIDGET_GROUPS.flatMap((g) => ALL.filter((w) => w.group === g));

const BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));
export function widgetById(id: string): WidgetDef | undefined {
  return BY_ID.get(id);
}

/**
 * Widgets that belong to the Apex app, i.e. the Mastery add-on (SPO-518): everything in the Apex group except `streak`,
 * which is core training. (Decision taken under the owner's rule 21.10: decide by best practice and finish.) Roles the store does not offer
 * Mastery to keep everything. A hook: call it before any early return; saved layouts keep their items either way.
 */
export const MASTERY_WIDGET_IDS: ReadonlySet<string> = new Set([
  'apex-challenge',
  'apex-rank',
  'apex-awards',
  'apex-feed',
  'apex-mastery',
  'apex-level-up',
  'apex-next-feat',
  'apex-feats-board',
  'apex-year-feats',
  // Standards and challenges are Apex content (they deep-link into it).
  'standards',
  'challenge-to-try',
]);
/** Widgets of the Sleep add-on (SPO-518). */
export const SLEEP_WIDGET_IDS: ReadonlySet<string> = new Set([
  'sleep',
  'sleep-debt',
  'bedtime-consistency',
  'naps',
]);
/**
 * Single widgets that belong to a Health module (the Health group mixes them with core rest/illness widgets, so ids decide, not
 * the group). Rest and illness stay core.
 */
export const HEALTH_WIDGET_ADDON: Readonly<Record<string, string>> = {
  rehab: 'injury-log',
  'rest-illness-log': 'rest',
  cycle: 'cycle',
};
/** Widgets that belong to an Apex module: they follow the module switch as well as Apex itself. */
export const APEX_WIDGET_MODULE: Readonly<Record<string, string>> = {
  'apex-challenge': 'apex-challenges',
  'challenge-to-try': 'apex-challenges',
  'apex-rank': 'apex-ranks',
  'apex-awards': 'apex-awards',
  'apex-mastery': 'mastery',
  'apex-level-up': 'mastery',
  // Standards are ranks, feats are awards (hard guard: each module switches its own widgets off)
  standards: 'apex-ranks',
  'apex-next-feat': 'apex-awards',
  'apex-feats-board': 'apex-awards',
  'apex-year-feats': 'apex-awards',
};
/** Widgets of other add-ons that sit in a core group. */
const OTHER_WIDGET_ADDON: Readonly<Record<string, string>> = {
  'home-sets': 'home-sets',
  goals: 'goals',
  playbook: 'playbook',
  'physique-goal': 'goals',
};
/** Widgets outside the cardio group that read or log activities. */
const ACTIVITY_WIDGET_IDS: ReadonlySet<string> = new Set(['activities-week', 'rest-day-idea']);
export function useWidgetAvailable(): (w: WidgetDef) => boolean {
  const available = useAddonAvailable();
  return (w) =>
    (!MASTERY_WIDGET_IDS.has(w.id) || available('apex')) &&
    (!SLEEP_WIDGET_IDS.has(w.id) || available('sleep')) &&
    (!HEALTH_WIDGET_ADDON[w.id] || available(HEALTH_WIDGET_ADDON[w.id])) &&
    (!APEX_WIDGET_MODULE[w.id] || available(APEX_WIDGET_MODULE[w.id])) &&
    (!OTHER_WIDGET_ADDON[w.id] || available(OTHER_WIDGET_ADDON[w.id])) &&
    (w.group !== 'atlas' || available('atlas')) &&
    // The whole cardio group and the week's activities are Activities.
    ((w.group !== 'cardio' && !ACTIVITY_WIDGET_IDS.has(w.id)) || available('activities'));
}

/** The widgets this person can use now, with an id lookup that skips the ones their add-ons leave out. */
export function useWidgetCatalog() {
  const available = useWidgetAvailable();
  return {
    widgets: WIDGETS.filter(available),
    widgetById: (id: string) => {
      const w = widgetById(id);
      return w && available(w) ? w : undefined;
    },
  };
}
