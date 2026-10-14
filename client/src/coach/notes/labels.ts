import type { LocaleId } from '../../i18n';
import type { ChatStrings } from '../../i18n/coachChat';
import type { NotesStrings } from '../../i18n/coachNotes';
import { dayLabel } from '../chat/format';
import { coachClock } from '../format';
import type { Note, NoteAnchor, AnchorKind } from './types';
import { noteEdited } from './types';

export const ANCHOR_ICON: Record<AnchorKind, string> = {
  message: 'envelope',
  decision: 'scales',
  day: 'calendar-check',
  exercise: 'barbell',
  none: 'pencil-simple',
};

/** "Today 08:40" / "Tue 6 Oct 20:05", plus the edited marker. */
export function noteTime(
  ch: ChatStrings,
  nt: NotesStrings,
  locale: LocaleId,
  n: Note,
  now: number,
): string {
  const base = `${dayLabel(n.at, now, ch, locale)} ${coachClock(n.at)}`;
  return noteEdited(n) ? `${base} · ${nt.nEdited}` : base;
}

/** The line a note shows for what it hangs on. */
export function anchorLabel(
  ch: ChatStrings,
  nt: NotesStrings,
  locale: LocaleId,
  a: NoteAnchor,
  now: number,
): string {
  switch (a.kind) {
    case 'message':
      return nt.nAnchorMessage(
        a.at != null ? `${dayLabel(a.at, now, ch, locale)} ${coachClock(a.at)}` : '',
      );
    case 'decision':
      return nt.nAnchorDecision(a.text ?? '');
    case 'day':
      return nt.nAnchorDay(a.text ?? '');
    case 'exercise':
      return nt.nAnchorExercise(a.text ?? '');
    default:
      return nt.nAnchorNone;
  }
}

export function anchorChipLabel(nt: NotesStrings, a: NoteAnchor): string {
  switch (a.kind) {
    case 'message':
      return nt.nCtxMessage;
    case 'decision':
      return nt.nCtxDecision;
    case 'day':
      return nt.nCtxDay;
    case 'exercise':
      return nt.nCtxExercise;
    default:
      return nt.nCtxGeneral;
  }
}

/** Search text of a note: its words and its context. */
export function noteMatches(n: Note, q: string, anchorText: string): boolean {
  const s = q.trim().toLowerCase();
  return !s || `${n.text} ${anchorText}`.toLowerCase().includes(s);
}
