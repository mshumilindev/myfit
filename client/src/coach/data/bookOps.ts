/** Serializable decision-book operations: what the offline queue stores and what the store re-applies after a refresh. */
import {
  acknowledgeSignal,
  dismissSignal,
  recordProgramDecision,
  removeDecision,
  snoozeSignal,
  withOutcome,
  type DecisionBook,
  type DismissReason,
  type Outcome,
} from '../domain/decisions';
import type { Option } from '../domain/diff';
import type { Signal } from '../domain/types';

export type BookOp =
  | { t: 'record'; id: string; signal: Signal; option: Option; message: string; now: number }
  | { t: 'snooze'; id: string; signal: Signal; now: number }
  | { t: 'dismiss'; id: string; signal: Signal; reason: DismissReason; now: number }
  | { t: 'undo'; id: string }
  | { t: 'ack'; signal: Signal; now: number }
  | { t: 'outcome'; id: string; outcome: Outcome; windowEndsAt: number | null };

export function applyOp(book: DecisionBook, op: BookOp): DecisionBook {
  switch (op.t) {
    case 'record':
      return recordProgramDecision(book, {
        id: op.id,
        signal: op.signal,
        option: op.option,
        now: op.now,
        message: op.message,
      });
    case 'snooze':
      return snoozeSignal(book, op.id, op.signal, op.now);
    case 'dismiss':
      return dismissSignal(book, op.id, op.signal, op.reason, op.now);
    case 'undo':
      return removeDecision(book, op.id);
    case 'ack':
      return acknowledgeSignal(book, op.signal, op.now);
    case 'outcome':
      return withOutcome(book, op.id, op.outcome, op.windowEndsAt ?? undefined);
  }
}
