/**
 * The leaf types of the data export (a file, what is missing and why). No imports, so any module (an add-on's runtime
 * included) can name them without pulling the store into a cycle; `exportModel` re-exports them for the rest of the export.
 */
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
