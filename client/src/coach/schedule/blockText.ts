import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { coachClock } from '../format';
import { endOf, peopleOf } from './model';
import { cardStateOf } from './status';
import type { People } from './people';
import type { ScheduleSlot } from './types';

/** The one-line name of a session: "Andriy", "Mobility class", "Split: Natalia, Bohdan". */
export function slotTitle(s: ScheduleSlot, p: People, t: ScheduleStrings): string {
  const ids = peopleOf(s);
  if (s.kind === 'group') return s.title ?? t.scGroupTitle;
  if (s.kind === 'split') return t.scSplitTitle(ids.map(p.first).join(', '));
  return p.first(ids[0] ?? s.clientId);
}

export const slotClock = (s: ScheduleSlot): string =>
  `${coachClock(s.start)}–${coachClock(endOf(s))}`;

/** The status word of a session; with `now` a running session reads "In progress". */
export function statusWord(s: ScheduleSlot, t: ScheduleStrings, now?: number): string {
  if (now !== undefined && cardStateOf(s, now) === 'inprogress') return t.scInProgress;
  if (s.status === 'done') return t.scDone;
  if (s.status === 'missed') return t.scMissed;
  if (s.status === 'moved') return t.scMoved;
  if (s.status === 'pending-move') return t.rcPending;
  return t.scPlanned;
}
