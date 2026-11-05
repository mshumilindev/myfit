/** Look of each store item (SPO-513): kit tone per manifest tone, glyph per id. */
import type { Tone } from '../components/ui/tones';
import type { AddonTone } from '../addons/manifest';
import type { addonStoreEn } from '../i18n/addonStore.en';

export type ItemId = keyof typeof addonStoreEn.items;

/** Manifest tone 0..9 → kit family (by meaning: food, learn, sleep, media, health, gym, atlas, themes, mastery, calls). */
export const STORE_TONE: Record<AddonTone, Tone> = {
  0: 'kcal',
  1: 'learn',
  2: 'sleep',
  3: 'conditioning',
  4: 'injury',
  5: 'gym',
  6: 'atlas',
  7: 'accent',
  8: 'apex',
  9: 'coach',
};

export const STORE_ICON: Record<ItemId, string> = {
  health: 'heartbeat',
  'injury-log': 'bandaids',
  cycle: 'drop',
  supplements: 'pill',
  'nicotine-alcohol': 'wind',
  sleep: 'moon',
  'sleep-auto-start': 'timer',
  'sleep-sounds': 'wave-sine',
  atlas: 'brain',
  mastery: 'medal',
  themes: 'palette',
  'exercise-media': 'image-square',
  calls: 'chat-circle',
  gyms: 'barbell',
  nutrition: 'fork-knife',
  music: 'disco-ball',
};
