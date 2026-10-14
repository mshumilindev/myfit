/**
 * Pure edits of a schedule doc (what the store applies, retries on a `rev` conflict, and undoes). Every edit is a function
 * `ScheduleDoc -> ScheduleDoc` so a lost race can re-apply the user's intent to the newer doc (R-BE-CAL-3).
 */
import {
  MAX_ROWS,
  type ExceptionDoc,
  type OneOffDoc,
  type PatternDoc,
  type ScheduleDoc,
} from './types';

export type DocEdit = (d: ScheduleDoc) => ScheduleDoc;

export class LimitError extends Error {
  constructor(readonly code: 'too-many-rows' | 'too-many-exceptions') {
    super(code);
    this.name = 'LimitError';
  }
}
const MAX_EXCEPTIONS = 400;

export const addPattern =
  (p: PatternDoc): DocEdit =>
  (d) => {
    const rows = d.patterns.reduce((n, x) => n + x.rows.length, 0) + p.rows.length;
    if (rows > MAX_ROWS) throw new LimitError('too-many-rows');
    return { ...d, patterns: [...d.patterns.filter((x) => x.id !== p.id), p] };
  };
export const addOneOff =
  (o: OneOffDoc): DocEdit =>
  (d) => {
    if (d.oneOffs.length + d.exceptions.length >= MAX_EXCEPTIONS)
      throw new LimitError('too-many-exceptions');
    return { ...d, oneOffs: [...d.oneOffs.filter((x) => x.id !== o.id), o] };
  };
/** Undo of a save: removes what that save added. */
export const removeCreated =
  (patternIds: readonly string[], oneOffIds: readonly string[]): DocEdit =>
  (d) => ({
    ...d,
    patterns: d.patterns.filter((p) => !patternIds.includes(p.id)),
    oneOffs: d.oneOffs.filter((o) => !oneOffIds.includes(o.id)),
  });
export const cancelInstance =
  (key: string): DocEdit =>
  (d) =>
    d.cancelled.includes(key) ? d : { ...d, cancelled: [...d.cancelled, key] };
export const uncancelInstance =
  (key: string): DocEdit =>
  (d) => ({ ...d, cancelled: d.cancelled.filter((k) => k !== key) });
export const mark =
  (e: ExceptionDoc): DocEdit =>
  (d) => {
    if (d.exceptions.length >= MAX_EXCEPTIONS) throw new LimitError('too-many-exceptions');
    return { ...d, exceptions: [...d.exceptions.filter((x) => x.slotKey !== e.slotKey), e] };
  };
export const unmark =
  (slotKey: string): DocEdit =>
  (d) => ({ ...d, exceptions: d.exceptions.filter((x) => x.slotKey !== slotKey) });
