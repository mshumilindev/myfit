import type { ProgramEditorLabels } from '../labels';
import type { Change } from '../model/diff';
import { dowOf } from '../model/doc';

/** What changed between two versions of a program, one line each (the version row of the info band). */
export function ChangeList({
  changes,
  labels: p,
  notes = [],
}: {
  changes: readonly Change[];
  labels: ProgramEditorLabels;
  /** Quiet lines under the changes (the version's own note, what is live). */
  notes?: readonly string[];
}) {
  return (
    <ul className="pe-diff">
      {changes.length === 0 && <li>{p.edDiffNone}</li>}
      {changes.map((c, i) => (
        <li key={i} className={`pe-diff-${c.op}`}>
          <span aria-hidden className="pe-diff-m">
            {c.op === 'add' ? '+' : c.op === 'remove' ? '−' : '~'}
          </span>
          <span>
            {c.op === 'add'
              ? p.edDiffAdd(c.name, p.dowShort[dowOf(c.day)], c.sets, c.reps)
              : c.op === 'remove'
                ? p.edDiffRemove(c.name, p.dowShort[dowOf(c.day)])
                : p.edDiffChange(
                    c.name || p.dowShort[dowOf(c.day)],
                    p.dowShort[dowOf(c.day)],
                    p.edDiffWhat[c.what],
                  )}
          </span>
        </li>
      ))}
      {notes.map((n, i) => (
        <li key={`n${i}`} className="pe-diff-note">
          {n}
        </li>
      ))}
    </ul>
  );
}
