/**
 * The approved store previews (SPO-556): per item, the shot names in slider order. Files live in
 * public/store-previews/<shot>-m.webp (phone) and <shot>-d.webp (desktop window).
 */
export const WEEK_SHOTS: Readonly<Record<string, readonly string[]>> = {
  apex: ['apex-home', 'apex-challenges', 'apex-ranks', 'apex-awards', 'apex-mastery'],
  activities: ['activities-1', 'activities-2', 'activities-3'],
  'home-sets': ['home-1', 'home-2'],
  goals: ['goals-1'],
  playbook: ['playbook-1'],
  sleep: ['sleep-1', 'sleep-2', 'sleep-3'],
  health: ['health-1', 'health-2', 'health-3'],
  atlas: ['atlas-1', 'atlas-2', 'atlas-3', 'atlas-4', 'atlas-5'],
  'theme-cyberpunk': ['cyber-c2'],
  'theme-brass-glass': ['theme-glass-c'],
  'holiday-themes': ['theme-halloween-c', 'theme-christmas-c'],
};

export const previewUrl = (shot: string, kind: 'm' | 'd') =>
  `${import.meta.env.BASE_URL ?? '/'}store-previews/${shot}-${kind}.webp`;
