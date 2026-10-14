import type { SharedInjury } from '../domain/types';

/** The app dictionary keys the labels come from (`t.injBodyParts`, `t.injSide`, `t.injReason`, `t.injStage`). */
export interface InjuryWords {
  injBodyParts: Record<string, string>;
  injSide: Record<string, string>;
  injReason: Record<string, string>;
  injStage: Record<string, string>;
}

/** "Left knee" for a localised injury, "After surgery" for the general branch. */
export function injuryName(w: InjuryWords, i: SharedInjury): string {
  if (i.reason !== 'injury' || !i.bodyPart) return w.injReason[i.reason] ?? i.reason;
  const part = w.injBodyParts[i.bodyPart] ?? i.bodyPart;
  const side = i.side ? w.injSide[i.side] : undefined;
  return side ? `${side} ${part.toLowerCase()}` : part;
}

/** The roster "Restriction" line: the active (not healed) injuries by name; null when there is none to show. */
export function restrictionLine(
  w: InjuryWords,
  list: readonly SharedInjury[] | undefined,
): string | null {
  const active = (list ?? []).filter((i) => !i.healed);
  return active.length ? active.map((i) => injuryName(w, i)).join(', ') : null;
}
