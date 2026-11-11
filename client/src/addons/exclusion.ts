/**
 * The exclusion contract (owner 10.11): an add-on that is not installed counts for NOTHING anywhere in the app — no screen,
 * tile, widget, shortcut, model, nudge or Atlas fact — while its data stays stored and comes back on re-install.
 *
 * Every add-on of the manifest declares here HOW it is switched off and WHICH files enforce that. The contract test
 * (`exclusion.contract.test.ts`) turns a missing entry, a missing file or a file that no longer names the add-on into a red
 * CI: a new add-on cannot ship without its exclusion, and an enforcing file cannot lose its gate silently.
 *
 *   state-mask  the store's `exposed()` view shows the empty value; readers cannot see the data (maskStore.ts)
 *   consent     Health modules: the consent/module mask of healthAddons.ts + maskHealth
 *   gate        screens, tiles, widgets, shortcuts and nudges ask `useAddonOrBase` / `addonAvailable`
 *   theme       the look is not on the allowed list (themes/registry.ts `setAllowedThemes`)
 *   base        part of the role's base: never removed
 *   soon        not available yet
 */
export type ExclusionVia = 'state-mask' | 'consent' | 'gate' | 'theme' | 'base' | 'soon';

export interface Exclusion {
  via: readonly ExclusionVia[];
  /** Files (relative to client/src) that enforce it; each must name the add-on id or one of its gate functions. */
  files: readonly string[];
  /** Words that count as "names the add-on" besides the id (gate functions, flags). */
  names?: readonly string[];
}

const HEALTH_MODULE: Exclusion = { via: ['consent', 'gate'], files: ['healthAddons.ts'] };

export const EXCLUSION: Readonly<Record<string, Exclusion>> = {
  health: { via: ['consent', 'gate'], files: ['healthAddons.ts', 'store.ts'] },
  'injury-log': { via: ['consent', 'gate'], files: ['healthAddons.ts', 'today/registry.tsx'] },
  rest: HEALTH_MODULE,
  unwell: HEALTH_MODULE,
  conditions: HEALTH_MODULE,
  cycle: HEALTH_MODULE,
  supplements: HEALTH_MODULE,
  nicotine: HEALTH_MODULE,
  alcohol: HEALTH_MODULE,
  sleep: {
    via: ['state-mask', 'gate'],
    files: ['addons/maskStore.ts', 'addons/featureGates.ts'],
    names: ['sleepAvailable', 'sleep:'],
  },
  activities: {
    via: ['state-mask', 'gate'],
    files: ['addons/maskStore.ts', 'addons/activitiesGate.ts'],
    names: ['activities'],
  },
  planner: {
    via: ['gate'],
    files: ['addons/featureGates.ts', 'plannerRt.ts', 'App.tsx'],
    names: ['plannerAvailable', 'usePlannerOn', 'usePlannerHost'],
  },
  goals: {
    via: ['state-mask', 'gate'],
    files: ['addons/maskStore.ts', 'addons/featureGates.ts'],
    names: ['goalsAvailable', 'goals:'],
  },
  atlas: {
    via: ['state-mask', 'gate'],
    files: ['addons/maskStore.ts', 'addons/featureGates.ts'],
    names: ['atlasAvailable', 'atlas:'],
  },
  playbook: {
    via: ['gate'],
    files: ['addons/featureGates.ts', 'App.tsx', 'today/registry.tsx'],
    names: ['usePlaybookOn'],
  },
  'home-sets': {
    via: ['gate'],
    files: ['App.tsx', 'today/registry.tsx', 'components/StartSheet.tsx'],
  },
  apex: { via: ['gate'], files: ['addons/useAddonRuntime.ts', 'views/ApexApp.tsx'] },
  'apex-challenges': {
    via: ['gate'],
    files: ['addons/useAddonRuntime.ts', 'views/ApexHome.tsx', 'today/registry.tsx'],
  },
  'apex-ranks': {
    via: ['gate'],
    files: ['addons/useAddonRuntime.ts', 'views/ApexHome.tsx', 'today/registry.tsx'],
  },
  'apex-awards': {
    via: ['gate'],
    files: ['addons/useAddonRuntime.ts', 'views/ApexHome.tsx', 'today/registry.tsx'],
  },
  mastery: {
    via: ['gate'],
    files: ['addons/useAddonRuntime.ts', 'App.tsx', 'today/registry.tsx'],
    names: ['masteryOn'],
  },
  'theme-brass-glass': {
    via: ['theme'],
    files: ['themes/registry.ts'],
    names: ['setAllowedThemes'],
  },
  'theme-cyberpunk': { via: ['theme'], files: ['themes/registry.ts'], names: ['setAllowedThemes'] },
  'holiday-themes': { via: ['theme'], files: ['themes/registry.ts'], names: ['setAllowedThemes'] },
  gym: { via: ['base'], files: ['addons/manifest.ts'], names: ['baseFor'] },
  coach: { via: ['base', 'gate'], files: ['addons/manifest.ts'], names: ['baseFor'] },
  'coach-live': { via: ['gate'], files: ['coach/CoachApp.tsx', 'coach/routes.ts'] },
  'coach-signals': { via: ['gate'], files: ['coach/CoachApp.tsx', 'coach/routes.ts'] },
  'coach-notes': { via: ['gate'], files: ['coach/notes/NotesHost.tsx', 'coach/threadExtras.tsx'] },
  'coach-team': { via: ['gate'], files: ['coach/CoachApp.tsx', 'coach/routes.ts'] },
  nutrition: { via: ['soon'], files: ['addons/manifest.ts'], names: ['soon'] },
  music: { via: ['soon'], files: ['addons/manifest.ts'], names: ['soon'] },
};
