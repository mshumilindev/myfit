/**
 * The one-line "what changed" a trainer sends with a version (sealed as `versions.summary`, shown to the client in the
 * "Program updated" notice and card and in the trainer's version list). Built from the real diff of the version against
 * the live one, in the trainer's own words (their locale's editor dictionary), so it is true without anyone typing it.
 * Short on purpose: the first few changes, then a plain count of the rest.
 */
import type { Change } from './ops';
import type { PgStrings } from '../../i18n/coachProgram';

const MAX_LINES = 4;
const MAX_CHARS = 280;

export function summarizeChanges(changes: readonly Change[], p: PgStrings): string {
  const line = (c: Change): string => {
    const day = p.dowShort[DOW[c.day - 1] ?? 'Mon'];
    return c.op === 'add'
      ? p.edDiffAdd(c.name, day, c.sets, c.reps)
      : c.op === 'remove'
        ? p.edDiffRemove(c.name, day)
        : p.edDiffChange(c.name || day, day, p.edDiffWhat[c.what]);
  };
  const shown = changes.slice(0, MAX_LINES).map(line);
  const rest = changes.length - shown.length;
  const text = shown.join('; ') + (rest > 0 ? ` (+${rest})` : '');
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
