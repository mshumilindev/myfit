/**
 * Everything the screens show, derived once from data + decision book + clock (R-FE-102: no hand-typed
 * duplicates). Roster, Today, Signals, Decisions and the header counts all read this object.
 */
import {
  annotateSignals,
  summarizeDecisions,
  type AnnotatedSignal,
  type DecisionRecord,
} from '../domain/decisions';
import { pickCards, type Picked } from '../domain/cards';
import { buildRoster, countRoster, type RosterCounts, type RosterRow } from '../domain/roster';
import { detectSignals } from '../domain/signals';
import { pendingMoves } from '../domain/slots';
import type { ClientHistory } from '../domain/history';
import type { Slot } from '../domain/types';
import type { DecisionBook } from '../domain/decisions';
import type { ScheduleData } from '../schedule/port';
import { joinSchedule } from './firestore/scheduleJoin';
import type { WorldData } from './port';

export interface DerivedWorld {
  now: number;
  asOf: number;
  trainer: { id: string; name: string };
  rows: RosterRow[];
  counts: RosterCounts;
  /** every signal with its state (open / decided / snoozed / dismissed) for "All signals" */
  signals: AnnotatedSignal[];
  picked: Picked;
  decisions: readonly DecisionRecord[];
  summary: ReturnType<typeof summarizeDecisions>;
  slots: Slot[];
  pendingMoves: Slot[];
  /** clients with a "Wrong data" flag */
  dataQuality: Readonly<Record<string, number>>;
  /** Overview history per client; undefined when the adapter has none */
  history: Readonly<Record<string, ClientHistory>>;
}

/**
 * `schedule` is the live schedule store (the single source of truth for sessions): when it holds documents, the slots,
 * the pending moves, each client's `planned` and the engine's planned counts come from IT, not from the snapshot the
 * port loaded earlier. An accepted or declined reschedule therefore moves Today, Roster and the Week counts in the same
 * session, without a world reload. Without schedule documents the port's own slots are used (as before).
 */
export function deriveWorld(
  data: WorldData,
  book: DecisionBook,
  now: number,
  schedule?: ScheduleData | null,
): DerivedWorld {
  const live =
    schedule && schedule.docs.length
      ? joinSchedule({ clients: data.clients, inputs: data.inputs, now }, schedule)
      : null;
  const clients = live?.clients ?? data.clients;
  const inputs = live?.inputs ?? data.inputs;
  const slots = live?.slots ?? data.slots;
  const active = clients.filter((c) => !c.invite);
  const all = detectSignals(
    inputs.filter((i) => active.some((c) => c.id === i.clientId)),
    now,
  );
  const annotated = annotateSignals(book, all, now);
  const open = annotated.filter((a) => a.state === 'open').map((a) => a.signal);
  const rows = buildRoster(clients, open);
  return {
    now,
    asOf: data.asOf,
    trainer: data.trainer,
    rows,
    counts: countRoster(rows),
    signals: annotated,
    picked: pickCards(open, active.length),
    decisions: book.decisions,
    summary: summarizeDecisions(book.decisions),
    slots,
    pendingMoves: pendingMoves(slots),
    dataQuality: book.dataQuality,
    history: data.history ?? {},
  };
}
