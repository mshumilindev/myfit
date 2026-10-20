/**
 * Client side of the trainer link (M7). Plain data, no copy (words live in i18n/coachClient). Times are epoch ms.
 * Everything here is the CLIENT's own view: the grants the client gave, the trainer's public identity, the read log
 * entries about the client's data, and the trainer's program layer on the client's own program.
 */
import type { Program } from '../../../views/programs/model';
import type { Category, Consent, Dow } from '../../domain/types';

/** none: no trainer | waiting: grants saved, trainer app has not turned sharing on yet | active | revoked: client stopped sharing */
export type LinkState = 'none' | 'waiting' | 'active' | 'revoked';

export interface TrainerInfo {
  id: string;
  name: string;
  /** "Iron Yard, Kyiv" (the trainer's gym / studio line) */
  org: string;
  since: number;
  hasPhoto?: boolean;
}

export interface ClientLink {
  state: LinkState;
  trainer: TrainerInfo | null;
  /** What the client shares. Checkins are not a setting (replies you send are shared by nature). */
  grants: Consent;
  /** Conversation id (the chat). */
  cid: string | null;
  /** My own id as the trainer knows me. */
  clientId: string;
  lastSeenAt: number | null;
  /** Linked before the consent model (the legacy trainer pointer): nothing is shared until the client chooses. */
  migrated?: boolean;
}

export type InviteState = 'valid' | 'expired' | 'used' | 'declined';
export interface InviteInfo {
  token: string;
  state: InviteState;
  trainerName: string;
  org: string;
  expiresAt: number;
}

/** What the trainer opened. One entry per category per tab open (R-FE-061). */
export type AccessWhat = 'week' | 'session' | 'history' | 'summary' | 'live';
export interface AccessEntry {
  id: string;
  at: number;
  category: Category;
  what: AccessWhat;
  /** reads of this category by this way on this day, merged by the server into one row (1 when it was read once) */
  count?: number;
  /** data, not copy: "Tue 6 Oct" / "Bench press" */
  ref?: string;
}

export interface TargetRow {
  sets: number;
  reps: number;
  kg: number | null;
  rpe: number | null;
  restSec: number | null;
  note?: string;
}
export interface PlannedActivity {
  id: string;
  /** ISO weekday 1..7 */
  day: number;
  name: string;
  minutes: number;
  when: 'before' | 'after';
}
export interface ProgramLayer {
  version: number;
  updatedAt: number;
  /** summary line the trainer wrote ("new targets, 2 changes") */
  summary: string;
  /** the client opened / acknowledged this version */
  acked: boolean;
  trainerDays: readonly Dow[];
  /** by exercise name (data) */
  targets: Readonly<Record<string, TargetRow>>;
  activities: readonly PlannedActivity[];
  /**
   * The whole live program exactly as the trainer wrote it (sealed in the version, opened on this device): every item
   * by id with targets, warm-up weights, supersets, per-day names. `targets` / `activities` above are the by-name
   * summary for the screens; the workout reads THIS (by item id), so two rows of one exercise never collapse.
   */
  program?: Program;
}

export interface ClientSnapshot {
  link: ClientLink;
  program: ProgramLayer | null;
  /** Without an in-app trainer: days the member marks as "with my coach" (decision 6). */
  selfCoachDays: readonly Dow[];
  asOf: number;
}

export type ClientPortErrorCode =
  | 'offline'
  | 'unavailable'
  | 'vault-locked'
  | 'not-found'
  | 'forbidden'
  | 'not-deployed'
  | 'timeout';
export class ClientPortError extends Error {
  constructor(
    readonly code: ClientPortErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'ClientPortError';
  }
}

/** The client's view of the trainer's team (SPO-205): names and roles, and what managers did with this client's schedule. */
export interface ClientTeam {
  trainerName: string;
  members: { name: string; role: 'trainer' | 'manager' }[];
  actions: { id: string; kind: string; actorName: string; ts: number }[];
}
