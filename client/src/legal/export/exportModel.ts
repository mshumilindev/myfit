/**
 * The data export (SPO-295 N6, Art. 15 and 20): what it is made of. Pure types and constants: no React, no stores.
 * The file is built ON THIS DEVICE from what the app can already read and decrypt; nothing new is fetched. Whatever cannot be
 * read here (held only on the server, not loaded, switched off, under someone else's key) is listed in the manifest as
 * "not included here" with a reason, never silently left out and never invented.
 */
import type { ConsentRecord } from '../consents';
import type { StoreState } from '../../store';
import type { ChatMsg } from '../../atlas/chatLog';
import type { Entry, Food, Goal, NutritionProfile } from '../../nutrition/types';

/** The pieces the person can switch on and off. Consent history travels with the account. */
export const EXPORT_CATEGORIES = ['account', 'training', 'body', 'atlas', 'sharing'] as const;
export type ExportCategory = (typeof EXPORT_CATEGORIES)[number];

export type MissingReason =
  /** Kept on our servers; this device has no way to read it. */
  | 'server-only'
  /** Readable in the app, but not loaded on this device right now (open the part, or go online, and try again). */
  | 'not-loaded'
  /** Stored, but hidden while the feature has no consent: turn it on to include it. */
  | 'feature-off'
  /** Held under someone else's key (your trainer's private records): ask the person who keeps them. */
  | 'held-by-other';

export interface Missing {
  item: string;
  reason: MissingReason;
}

export type ExportContent =
  | { kind: 'json'; value: unknown }
  | { kind: 'csv'; header: readonly string[]; rows: readonly (readonly unknown[])[] };

export interface ExportFile {
  /** Path inside the category folder, e.g. `workouts.json`. */
  name: string;
  /** What the file holds, in a line (goes into the README). */
  about: string;
  content: ExportContent;
  /** Records in the file (rows of a table, items of a list). */
  rows?: number;
}

export interface CategoryResult {
  id: ExportCategory;
  files: ExportFile[];
  missing: Missing[];
}

export type StoreSlice = Pick<
  StoreState,
  | 'workouts'
  | 'gyms'
  | 'restPeriods'
  | 'injuries'
  | 'conditions'
  | 'conditionsShare'
  | 'nicotine'
  | 'cycle'
  | 'alcohol'
  | 'supplements'
  | 'activities'
  | 'weightUnit'
  | 'mastery'
  | 'bodyMetrics'
  | 'sleeps'
  | 'sleepSchedule'
  | 'sleepSettings'
  | 'goals'
  | 'coach'
  | 'home'
>;

export type HealthFeatureKey =
  'injuries' | 'chronic' | 'cycle' | 'nicotine' | 'alcohol' | 'supplements';

export interface NutritionData {
  entries: readonly Entry[];
  foods: readonly Food[];
  goal: Goal | null;
  profile: NutritionProfile | null;
  /** Stored, but hidden in the app because the food log has no consent. Included anyway: it is the person's own data. */
  hidden: boolean;
}

/** The stored health state as it is, not as the consent mask shows it (see `getStoredHealthForExport`). */
export type StoredHealth = Pick<
  StoreState,
  'injuries' | 'conditions' | 'conditionsShare' | 'cycle' | 'nicotine' | 'alcohol' | 'supplements'
>;

/** Everything the builders read. A part that is `null` could not be read on this device. */
export interface ExportSources {
  account: { uid: string | null; username: string | null; role: string | null };
  consents: readonly ConsentRecord[] | null;
  store: StoreSlice | null;
  /** The app's data on this device is confirmed in step with the account (otherwise it is this device's copy). */
  storeSynced: boolean;
  /** The stored health features exactly as stored (the consent mask does not apply to a person's own data copy). */
  health: StoredHealth | null;
  /** Of those, the features that are hidden in the app now because they have no consent (labelled in the README). */
  hiddenHealth: readonly HealthFeatureKey[];
  /** `null` = not loaded. */
  nutrition: NutritionData | null;
  chat: readonly ChatMsg[];
  /** Settings and small values kept in the account (exercise units, widget values, challenges, …), as cached on this device. */
  settings: Readonly<Record<string, unknown>>;
  hasTrainer: boolean;
}

export const FORMAT_VERSION = 'spotter-export/1';

const pad = (n: number) => String(n).padStart(2, '0');
/** `YYYY-MM-DD` in the device's local time. */
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** `spotter-export-<date>` (the file adds `.zip`). */
export const exportBaseName = (d: Date): string => `spotter-export-${localDate(d)}`;
