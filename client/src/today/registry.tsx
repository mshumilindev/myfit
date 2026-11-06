/**
 * Today widget registry — every widget the user can put in a section.
 * A widget renders itself in any of the four sizes (S · M · L · XL); the slot
 * of its section decides which. Widgets read the app's real data through ctx.
 *
 * The full catalogue (115 widgets, design page "Бібліотека віджетів") lands in
 * groups; each group registers here.
 */
import type { ReactNode } from 'react';
import { useAddonOrBase } from '../addons/enabledSet';
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
]);
/** Widgets of the Sleep add-on (SPO-518). */
export const SLEEP_WIDGET_IDS: ReadonlySet<string> = new Set(['sleep', 'sleep-debt']);
export function useWidgetAvailable(): (w: WidgetDef) => boolean {
  const mastery = useAddonOrBase('mastery');
  const sleep = useAddonOrBase('sleep');
  return (w) =>
    (mastery || !MASTERY_WIDGET_IDS.has(w.id)) && (sleep || !SLEEP_WIDGET_IDS.has(w.id));
}
