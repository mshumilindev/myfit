/**
 * Program editor data (M3). The draft IS the real `Program` of views/programs/model (days 1..7 = Mon..Sun, items, target
 * muscles, activities) with the trainer layer on the item (bare, targets) and on the ASSIGNMENT (trainer days), never on
 * the program: a shared program stays one program, every client has their own assignment and their own draft.
 */
import type { Program } from '../../views/programs/model';
import type { Dow } from '../domain/types';

export const ISO_OF_DOW: Record<Dow, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};
export const DOW_OF_ISO: Dow[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface VersionNote {
  n: number;
  /** epoch ms; null = the draft */
  at: number | null;
  by: string;
  /** What changed, in the trainer's words (user text: sealed as `versions.summary`). */
  summary: string;
}

export interface SharedWith {
  clientId: string;
  name: string;
  /** The version that client keeps until the trainer copies a newer one. */
  version: number;
}

export interface ProgramBundle {
  clientId: string;
  /** Optimistic concurrency token (`plans.rev`): saving with a stale one is a conflict, never a silent overwrite. */
  rev: number;
  /** The program name shown in headers ("Upper/Lower 4x"). */
  programName: string;
  /** The version the draft will become when sent (live version + 1). */
  draftVersion: number;
  /** The version the client has now. */
  liveVersion: number;
  live: Program;
  draft: Program;
  trainerName: string;
  /** Trainer days live on the assignment. */
  trainerDays: Dow[];
  sharedWith: SharedWith[];
  versions: VersionNote[];
  /** Whether the draft differs from what the server holds (a draft saved earlier is clean on load). */
  sentAt: number | null;
  /** The newest version the client opened (their acknowledgement), or null: nothing seen yet. */
  seen: { version: number; at: number } | null;
}

export type SaveResult = { rev: number };
export type ProgramPortErrorCode =
  'conflict' | 'offline' | 'forbidden' | 'unavailable' | 'vault-locked';
export class ProgramPortError extends Error {
  constructor(
    readonly code: ProgramPortErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'ProgramPortError';
  }
}

/** A day source for "Copy from a template or client": one training day of someone's program. */
export interface LibraryEntry {
  key: string;
  kind: 'template' | 'client';
  /** Program name. */
  name: string;
  /** Day name inside it ("Upper A"). */
  dayName: string;
  /** Short facts line (user data: names, counts), built from the model: "4 exercises · 13 sets". */
  exercises: number;
  sets: number;
  by?: string;
  clientId?: string;
  clientName?: string;
  /** The program the day is taken from, and which weekday (1..7). */
  program: Program;
  day: number;
}
