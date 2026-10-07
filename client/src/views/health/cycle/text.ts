/** Shared labels and helpers of the Cycle screens. */
import { dayOfTimestamp, timestampOfDay } from '../../../components/ui/calendarDays';
import type { CyclePhase } from '../../../cycle/cycleCore';
import type { Tone } from '../../../components/ui/tones';
import { fmtShortDate, useT } from '../../../i18n';

/** Phase tints reuse existing tone families (a dedicated cycle tone is a later design-token decision). */
export const PHASE_TONE: Record<CyclePhase, Tone> = {
  menses: 'conditioning',
  early: 'rest',
  mid: 'accent',
  late: 'sleep',
};
export const CYCLE_TONE: Tone = 'conditioning';

export const todayKey = (): number => dayOfTimestamp(Date.now());
export const dayText = (day: number): string => fmtShortDate(timestampOfDay(day));

export function useCycleText() {
  const { t } = useT();
  const phaseName: Record<CyclePhase, string> = {
    menses: t.cycPhMenses,
    early: t.cycPhEarly,
    mid: t.cycPhMid,
    late: t.cycPhLate,
  };
  const phaseHint: Record<CyclePhase, string> = {
    menses: t.cycHintMenses,
    early: t.cycHintEarly,
    mid: t.cycHintMid,
    late: t.cycHintLate,
  };
  return { t, phaseName, phaseHint };
}
