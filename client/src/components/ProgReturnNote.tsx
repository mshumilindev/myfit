/**
 * Progression target after a training break (SPO-149), shared by every screen
 * that shows a target: the one-word action label of a state and the one-line
 * explanation under a 'return' target ("3 weeks since your last squat -- ...").
 */
import { useExerciseName } from '../ui';
import { useT } from '../i18n';
import { gapWeeks } from '../detraining';
import type { ProgState, Target } from '../progression';
import { Hint } from './ui/Hint';

type T = ReturnType<typeof useT>['t'];

/** The action word of a progression state (exhaustive: a new state fails to compile). */
export function progActionLabel(t: T, state: ProgState): string {
  switch (state) {
    case 'progress':
      return t.progAdd;
    case 'stall':
      return t.progDeload;
    case 'hold':
      return t.progHold;
    case 'return':
      return t.progReturn;
    case 'first':
      return t.progFirst;
  }
}

/** The explanation of a 'return' target, or null for any other state. */
function returnNoteText(t: T, target: Target, lift: string): string | null {
  if (target.state !== 'return') return null;
  if (target.returnKind === 'regain') return t.progReturnRegain;
  const weeks = gapWeeks(target.gapDays ?? 0);
  return target.returnKind === 'ease'
    ? t.progReturnEase(weeks, lift)
    : t.progReturnCut(weeks, lift);
}

/** One quiet line under the target when it is a return after a break; nothing otherwise. */
export function ProgReturnNote({ target, lift }: { target: Target; lift: string }) {
  const { t } = useT();
  const exName = useExerciseName();
  const text = returnNoteText(t, target, exName(lift));
  return text ? <Hint>{text}</Hint> : null;
}
