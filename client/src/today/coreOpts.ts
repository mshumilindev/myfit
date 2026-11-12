/** Per-block options of the Today core sections (shapes and defaults); `layout.ts` re-exports them. Pure data, no store. */
/* ---------- per-block options (design B6 / A2) ---------- */

export type ProgramStyle = 'compact' | 'standard' | 'detailed';
export interface ProgramOpts {
  style: ProgramStyle;
  /** Mon–Sun status pills under the card. */
  weekPills: boolean;
  /** Today's exercises on the card. */
  exercises: boolean;
  /** Ask which gym before a program day starts (off: the gym you're in, else your last one). */
  gymStep: boolean;
  /** "Log past session" link when today has no plan. */
  logPast: boolean;
  /** Size of the fixed Planner card under the week (only shown while that add-on is installed). */
  plannerSize: 'M' | 'L' | 'XL';
}

export type AtlasLayout = 'together' | 'split';
/** `auto` = off when there are no new notes. */
export type AtlasView = 'note' | 'chat' | 'compact' | 'auto';
export type ClientsView = 'stories' | 'list';
export interface AtlasOpts {
  layout: AtlasLayout;
  atlasView: AtlasView;
  clientsView: ClientsView;
  order: 'atlas' | 'clients';
  liveFirst: boolean;
  hideInactive: boolean;
}

/** Every advisory card Today can show, each one switchable. */
export const NUDGE_KINDS = [
  'plan',
  'likely',
  'visit',
  'weigh',
  'analysis',
  'suggest',
  'readiness',
  'energy',
  'playbook',
  'learn',
  'sleep',
] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];
export interface NudgesOpts {
  /** Kinds switched off. */
  off: NudgeKind[];
}

export const HISTORY_DAYS = [3, 5, 7] as const;
export interface HistoryOpts {
  days: (typeof HISTORY_DAYS)[number];
  /** Which view History opens in (the header toggle switches it for the moment). */
  view: 'timeline' | 'calendar';
  /** Calendar: show upcoming planned program days (dashed). */
  planned: boolean;
}

export interface CoreOptsMap {
  atlas: AtlasOpts;
  program: ProgramOpts;
  nudges: NudgesOpts;
  history: HistoryOpts;
}
export type ConfigurableCore = keyof CoreOptsMap;
export type CoreOpts = CoreOptsMap[ConfigurableCore];
export const CONFIGURABLE: ConfigurableCore[] = ['atlas', 'program', 'nudges', 'history'];

/** Defaults = how Today behaved before blocks were configurable. */
export const CORE_DEFAULTS: CoreOptsMap = {
  atlas: {
    layout: 'together',
    atlasView: 'compact',
    clientsView: 'stories',
    order: 'atlas',
    liveFirst: true,
    hideInactive: false,
  },
  program: {
    style: 'standard',
    weekPills: true,
    exercises: false,
    gymStep: true,
    logPast: false,
    plannerSize: 'L',
  },
  nudges: { off: [] },
  history: { days: 5, view: 'timeline', planned: true },
};
