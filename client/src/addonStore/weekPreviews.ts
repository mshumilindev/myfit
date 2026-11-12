/**
 * The approved store previews (SPO-556): per item, the shot names in slider order. Files live in
 * public/store-previews/<shot>-m.webp (phone) and <shot>-d.webp (desktop window).
 */
export const WEEK_SHOTS: Readonly<Record<string, readonly string[]>> = {
  gym: [
    'gym-today',
    'gym-start',
    'gym-session',
    'gym-setopts',
    'gym-overview',
    'gym-programs',
    'gym-exercises',
    'gym-gyms',
    'gym-history',
    'gym-chat',
  ],
  coach: ['coach-agenda', 'coach-clients', 'coach-client', 'coach-schedule', 'coach-chat'],
  'coach-live': ['live-1'],
  'coach-signals': ['signals-1'],
  'coach-notes': ['notes-1'],
  'coach-team': ['team-1'],
  apex: ['apex-home', 'apex-challenges', 'apex-ranks', 'apex-awards', 'apex-mastery'],
  activities: ['activities-1', 'activities-2', 'activities-3', 'activities-start'],
  'home-sets': ['home-1', 'home-2', 'home-start'],
  goals: ['goals-1'],
  playbook: ['playbook-1'],
  planner: ['planner-today', 'planner-week', 'planner-form', 'planner-month', 'planner-settings'],
  sleep: ['sleep-1', 'sleep-2', 'sleep-3'],
  health: ['health-1', 'health-2', 'health-3', 'health-start'],
  atlas: ['atlas-1', 'atlas-2', 'atlas-3', 'atlas-4', 'atlas-5'],
  'theme-cyberpunk': ['cyber-c2'],
  'theme-brass-glass': ['theme-glass-c'],
  'holiday-themes': ['theme-halloween-c', 'theme-christmas-c'],
};

export const previewUrl = (shot: string, kind: 'm' | 'd') =>
  `${import.meta.env.BASE_URL ?? '/'}store-previews/${shot}-${kind}.webp`;

/** Previews of a module (a switch inside its app); a module without any shows no gallery. */
export const MODULE_SHOTS: Readonly<Record<string, readonly string[]>> = {
  'apex-challenges': ['apex-challenges'],
  'apex-ranks': ['apex-ranks'],
  'apex-awards': ['apex-awards'],
  mastery: ['apex-mastery'],
};
