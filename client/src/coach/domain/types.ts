/**
 * Coach domain types. Shapes follow the design-lab world (v11 world.ts, fixtures, slots, notes, chatstore)
 * but carry no display strings: copy lives in i18n, dates are epoch ms.
 */

/* ---- consent ------------------------------------------------------------------------------------------------- */
/** Stored enum (R-BE-CON-9): never changes with copy. */
export type Level = 'off' | 'effects' | 'full';
export const LEVELS: readonly Level[] = ['off', 'effects', 'full'];
export type Category = 'totals' | 'sets' | 'body' | 'sleep' | 'injury' | 'nutrition' | 'checkins';
export const CATEGORIES: readonly Category[] = [
  'totals',
  'sets',
  'body',
  'sleep',
  'injury',
  'nutrition',
  'checkins',
];
export type Consent = Readonly<Record<Category, Level>>;
/** How a client logs. `program` clients do not use the app: plan and chat only. */
export type LogMode = 'app' | 'hybrid' | 'program';

/* ---- people -------------------------------------------------------------------------------------------------- */
export type Dow = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const DOWS: readonly Dow[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** One injury / rehab entry the member shares (injury consent `full`), opened on the trainer's device. Plain data, no copy. */
export interface SharedInjury {
  id: string;
  /** 'injury' (a localised body part) or the general branch: 'surgery' | 'illness' | 'break' | 'cautious' */
  reason: string;
  /** body-part key of the member's app ('knee', 'lower_back' ...); empty on the general branch */
  bodyPart: string;
  side?: 'left' | 'right' | 'both';
  /** rehab stage key: 'protect' | 'reintroduce' | 'rebuild' | 'return' */
  stage: string;
  /** local day key the injury was logged */
  startDay: number;
  healed: boolean;
  /** the member's own free-text note (shared at `full`) */
  note?: string;
}

export interface CoachClient {
  id: string;
  name: string;
  goal: string;
  program: string;
  programWeek: number;
  gym: string;
  mode: LogMode;
  consent: Consent;
  streakWeeks: number;
  /** Planned / done sessions this week (derived by the adapter from slots; never hand-typed in UI). */
  planned: number;
  done: number;
  /** null = no session known (or not visible under the consent level). */
  lastSessionAt: number | null;
  trainerDays: readonly Dow[];
  /** A declared restriction, shown only when injury consent allows it. */
  restriction?: string;
  /** The member's shared injuries (real adapter, injury consent `full`); undefined when not shared or none read. */
  injuries?: readonly SharedInjury[];
  live?: boolean;
  /** The client has a profile photo in Storage (the app Avatar fetches it by `id`). */
  hasPhoto?: boolean;
  /** Revision of that photo (server `avatarRev`): a change refetches it, the same value serves the on-device copy. */
  photoRev?: number;
  /** `pending` = invite sent, not accepted yet. */
  invite?: { sentAt: number; expiresAt: number };
}

export type RosterStatus = 'urgent' | 'watch' | 'good' | 'none';

/* ---- signals ------------------------------------------------------------------------------------------------- */
export type SignalKind =
  'stall' | 'rhythm' | 'injury' | 'machine' | 'spike' | 'ready' | 'pr' | 'nodata';
export type Severity = 'urgent' | 'watch' | 'good';
export type Confidence = 'high' | 'medium' | 'low';

export interface EvidenceRow {
  /** Session / week start (epoch ms); null for rows without a date. */
  at: number | null;
  /** Data label such as an exercise name or a muscle (user data, not copy). */
  label: string;
  value: number;
  unit: 'kg' | 'sessions' | 'sets' | 'days' | 'rpe';
  /** Free detail such as "100x5, 100x5, 100x4". */
  detail?: string;
}

export interface Evidence {
  category: Category;
  /** The consent level the rows were read under (stored with the snapshot, R-BE-DEC-2). */
  level: Exclude<Level, 'off'>;
  /** false = weekly aggregates only; the drawer shows "Set-by-set evidence needs Full". */
  granular: boolean;
  rows: EvidenceRow[];
}

export interface Signal {
  /** Stable key: `clientId|kind|exerciseKey`. Dismiss/snooze/decide are keyed by it. */
  key: string;
  clientId: string;
  kind: SignalKind;
  severity: Severity;
  confidence: Confidence;
  /** 0-100, comparable within a kind; used to detect "evidence got stronger". */
  strength: number;
  exerciseKey: string | null;
  detectedAt: number;
  /** Machine facts the UI formats with i18n. */
  facts: Record<string, string | number | null>;
  evidence: Evidence[];
  /** Why a card exists without alarm: 'sets-not-shared' | 'no-data'. */
  reason?: 'sets-not-shared' | 'no-data';
}

/* ---- sessions / slots ---------------------------------------------------------------------------------------- */
export type SessionKind = 'solo' | 'split' | 'group';
export type SlotStatus = 'planned' | 'done' | 'missed' | 'moved' | 'pending-move';
export type AttendeeStatus = SlotStatus | 'declined';
export interface Attendee {
  clientId: string;
  status: AttendeeStatus;
  programDayId?: string | null;
}
export const MAX_ATTENDEES = 12;

export interface Slot {
  id: string;
  /** First attendee (older code reads this). */
  clientId: string;
  kind: SessionKind;
  title?: string;
  /** group only */
  capacity?: number;
  attendees: Attendee[];
  start: number;
  durationMin: number;
  gymId: string;
  status: SlotStatus;
  /** A pending reschedule request proposes this time. */
  move?: { reqId: string; from: 'client' | 'trainer'; start: number; note?: string };
}
