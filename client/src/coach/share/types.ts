/**
 * Share model (M5, plan 10.1 / 10.3). Chat is text only; the one "attachment" is a SHARE: a typed reference to something
 * that already exists in Spotter. The message stores only the `ShareRef` (sealed with the conversation key); the card is
 * built at render time with `resolveShare(ref, viewer, source)` from the READER's own access, so changing the item changes
 * the card, lowering consent turns it `locked`, deleting the item turns it `removed`. Nothing is copied into the message.
 *
 * Everything here is plain data. Words (labels, reasons, captions) live in the `coachShare` dictionary; the view carries
 * codes and data labels (names the user typed or the catalogue defines).
 */
import type { Category, Dow } from '../domain/types';

export const SHARE_KINDS = [
  'program',
  'day',
  'exercise',
  'equipment',
  'gym',
  'workout',
  'activity',
  'results',
  'muscle',
] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
export const isShareKind = (v: unknown): v is ShareKind =>
  typeof v === 'string' && (SHARE_KINDS as readonly string[]).includes(v);

/** What a message carries. `ownerId` is the client whose data it is (workout, activity, results, muscle) or `coach`. */
export interface ShareRef {
  kind: ShareKind;
  id: string;
  ownerId?: string;
}

/** Whose eyes the card is drawn for. A trainer viewing the thread with Oleh is `{ side: 'trainer', clientId: 'c1' }`. */
export interface Viewer {
  side: 'trainer' | 'client';
  clientId: string;
}

export type ShareState = 'ok' | 'locked' | 'removed' | 'loading' | 'limited';

/** Why a card is locked or removed (words are in the dictionary). */
export type ShareReason =
  | { code: 'notAssigned' }
  | { code: 'ownerDeleted' }
  | { code: 'notInLibrary' }
  | { code: 'notInHistory' }
  | { code: 'private' }
  | { code: 'notShared'; cat: Category }
  | { code: 'fewSessions' };

export type OpenLabel =
  | 'program'
  | 'programs'
  | 'day'
  | 'editor'
  | 'exercise'
  | 'equipment'
  | 'gym'
  | 'workouts'
  | 'strength'
  | 'muscle'
  | 'peek';

/** Where tapping a card goes. `client` = a screen of the real client app, `trainer` = a dashboard page or the peek drawer. */
export interface OpenTarget {
  app: 'trainer' | 'client';
  screen: string;
  params: Record<string, string>;
  label: OpenLabel;
  /** A detail drawer (LibraryPeek), not a page. */
  overlay?: boolean;
}

export type FactKey =
  | 'version'
  | 'exercises'
  | 'sets'
  | 'dayType'
  | 'equipment'
  | 'best'
  | 'foundIn'
  | 'amenities'
  | 'machines'
  | 'hours'
  | 'duration'
  | 'tonnage'
  | 'time'
  | 'effort'
  | 'distance'
  | 'avgHr'
  | 'e1rm'
  | 'change'
  | 'setsWeek'
  | 'usualRange'
  | 'usualWeekly';
export type FactUnit = 'min' | 'kg' | 'km' | 'bpm' | 't';
export interface ShareFact {
  key: FactKey;
  value: string | number;
  unit?: FactUnit;
  /** The value is a comma list of ids the card localises ('equipment': EquipmentId list; 'amenities' no). */
  list?: 'equipmentIds';
  /** `best` names the owner when the viewer is the trainer ("Oleh's best"). */
  who?: string;
}

/** The grey line under a title. */
export type ShareSub =
  | { k: 'program'; weeks: number; days: number }
  | { k: 'day'; program: string; wd?: Dow }
  | { k: 'text'; text: string }
  /** Exercise family ('chest'...), localised by the dictionary. */
  | { k: 'family'; id: FamilyId }
  /** Equipment category of the catalogue, localised by the app. */
  | { k: 'equipCat'; id: string }
  | { k: 'workout'; at: number; gym?: string }
  | { k: 'date'; at: number }
  | { k: 'results'; who?: string }
  | { k: 'muscle'; who?: string; you?: boolean };

export interface ShareRow {
  name: string;
  /** "4 x 8 . 70 kg" style meta is built by the card from these. */
  sets?: number;
  reps?: string;
  kg?: string;
  /** Best set text ("100x5") for workout rows. */
  top?: string;
  image?: string;
  bare?: boolean;
}

export interface ShareView {
  ref: ShareRef;
  kind: ShareKind;
  state: ShareState;
  icon: string;
  /** Data label (program name, exercise name...). Empty on `removed` and `loading`. */
  title: string;
  /** The title is a catalogue exercise name: the card shows it in the reader's language. */
  exerciseName?: boolean;
  sub?: ShareSub;
  facts: ShareFact[];
  /** Muscle ids (MuscleGroup) or data labels (route name). */
  chips?: string[];
  chipsAreMuscles?: boolean;
  rows?: ShareRow[];
  image?: string;
  /** Mini trend (results): estimated 1RM, oldest first. */
  series?: number[];
  /** Activity: stored GPS points [lat, lng]; drawn offline (no tiles). */
  track?: [number, number][];
  /** Muscle kind: the MuscleGroup id for the anatomy highlight. */
  muscle?: string;
  /** Day / workout recipient trains this day with the trainer. */
  withTrainer?: boolean;
  /** "Updates with the program" shows only where it is true. */
  updates?: boolean;
  reason?: ShareReason;
  /** Owner's first name (data) for reasons and the limited line. */
  who?: string;
  /** state `limited`: what is hidden. */
  limited?: { cat: Category };
  openTarget: OpenTarget;
}

/** Sources the resolver reads. Plain data; the adapter fills it (fixtures now, sealed caches later: see port.ts). */
export type FamilyId = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other';
export interface LibExercise {
  id: string;
  name: string;
  /** Primary first. MuscleGroup ids. */
  muscles: string[];
  /** Equipment ids of the catalogue taxonomy ('barbell', 'dumbbell'...). */
  equipment: string[];
  family: FamilyId;
  image?: string;
  /** Names in other languages, for search. */
  aliases: string[];
}
export interface LibEquipment {
  id: string;
  name: string;
  category: string;
  muscles: string[];
  image?: string;
  aliases: string[];
}
export interface LibGym {
  id: string;
  name: string;
  city: string;
  /** AmenityId list (the real app's catalogue). */
  amenities: string[];
  machines: number;
  hours?: string;
  /** Equipment ids this gym has (for "Found in"). */
  equipmentIds: string[];
  photo?: string;
  /** A private gym without an external id cannot be shared. */
  shareable: boolean;
}
export interface Library {
  exercises: readonly LibExercise[];
  equipment: readonly LibEquipment[];
  gyms: readonly LibGym[];
}

export interface ProgRow {
  name: string;
  exerciseId?: string;
  sets: number;
  reps?: string;
  kg?: string;
}
export interface ProgDay {
  name: string;
  wd?: Dow;
  rows?: ProgRow[];
  /** A muscles day. */
  muscles?: string[];
}
export interface ProgramSource {
  id: string;
  name: string;
  weeks: number;
  version?: string;
  days: ProgDay[];
  /** Client ids the program is assigned to. */
  assignedTo: string[];
  /** A template (not assigned to anyone yet). */
  template?: boolean;
}

export interface ActivitySource {
  id: string;
  at: number;
  /** ACTIVITY_TYPES key ('run', 'walk'...). */
  type: string;
  icon: string;
  minutes: number;
  effort: 'light' | 'moderate' | 'hard';
  km?: number;
  avgHr?: number;
  route?: string;
  points?: [number, number][];
}

export interface SessionRowSource {
  name: string;
  /** "100x5" */
  top: string;
  image?: string;
}
export interface WorkoutSource {
  id: string;
  at: number;
  title: string;
  minutes: number;
  sets: number;
  tonnageKg: number;
  gym?: string;
  withTrainer: boolean;
  rows: SessionRowSource[];
}
export interface ResultSource {
  id: string;
  name: string;
  /** Catalogue exercise id when the lift is a library exercise. */
  exerciseId?: string;
  /** Estimated 1RM, oldest first. */
  series: number[];
  best: string;
  e1rm: number;
  /** Change of the estimated 1RM over 4 weeks, kg. */
  change: number;
  sessions: number;
  image?: string;
}

/** One client's data as the trainer is allowed to read it (the adapter cuts by consent; the resolver gates again). */
export interface ClientShareData {
  clientId: string;
  firstName: string;
  mode: 'app' | 'hybrid' | 'program';
  consent: Readonly<Record<Category, 'off' | 'effects' | 'full'>>;
  workouts: readonly WorkoutSource[];
  activities: readonly ActivitySource[];
  results: readonly ResultSource[];
  /** Sets this week per MuscleGroup id. */
  weeklySets: Readonly<Record<string, number>>;
  /** The program days that are 1:1 with the trainer (weekday numbers 1 = Mon). */
  trainerDays: readonly Dow[];
}

export interface ShareSource {
  now: number;
  library: Library;
  programs: readonly ProgramSource[];
  /** Keyed by client id. A client viewer only ever gets their own entry. */
  clients: Readonly<Record<string, ClientShareData>>;
}

/** What the card shows while the source is still loading. */
export const loadingView = (ref: ShareRef): ShareView => ({
  ref,
  kind: ref.kind,
  state: 'loading',
  icon: 'circle-notch',
  title: '',
  facts: [],
  openTarget: { app: 'trainer', screen: 'home', params: {}, label: 'peek' },
});

export const refKey = (r: ShareRef): string =>
  `${r.kind}:${r.ownerId ? `${r.ownerId}/` : ''}${r.id}`;
export const sameRef = (a: ShareRef, b: ShareRef): boolean => refKey(a) === refKey(b);

/**
 * A share arriving in a message is untrusted until it is a well-formed typed ref (plan C.4: previews come from typed
 * ShareRefs resolved locally, never from URLs the sender controls). Unknown kinds or extra shapes are refused.
 */
export function parseShareRef(v: unknown): ShareRef | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isShareKind(o.kind) || typeof o.id !== 'string' || !o.id || o.id.length > 120) return null;
  if (o.ownerId !== undefined && (typeof o.ownerId !== 'string' || o.ownerId.length > 80))
    return null;
  return { kind: o.kind, id: o.id, ...(o.ownerId ? { ownerId: o.ownerId } : {}) };
}
