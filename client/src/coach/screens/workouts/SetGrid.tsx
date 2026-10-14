import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import type { C360Strings } from '../../../i18n/coachClient360';
import { type SetEntry, type WorkoutEntry } from '../../domain/workouts';

/**
 * The per-set grid of a session recap (read-only): one small table per exercise, in the order it was done. The
 * entry only has `exercises` when the client shares sets (`gateWorkouts`), so the grid never draws a locked set.
 */
export function SetGrid({ entry, c }: { entry: WorkoutEntry; c: C360Strings }) {
  const ex = entry.exercises ?? [];
  const cols: DataTableColumn<{ n: number; s: SetEntry }>[] = [
    { id: 'n', header: c.wkGridSet, muted: true, cell: (r) => r.n },
    { id: 'kg', header: c.wkGridKg, align: 'end', strong: true, cell: (r) => r.s.kg },
    { id: 'reps', header: c.wkGridReps, align: 'end', cell: (r) => r.s.reps },
    { id: 'rpe', header: c.wkGridRpe, align: 'end', muted: true, cell: (r) => r.s.rpe ?? '' },
  ];
  if (ex.length === 0) return <p className="c3-m">{c.wkGridNone}</p>;
  return (
    <div className="c3t-grid">
      {ex.map((x, i) => (
        <section key={`${x.name}-${i}`} className="c3t-grid-x">
          <SectionLabel role="heading" aria-level={4}>
            {x.name}
          </SectionLabel>
          {x.prescribed && (
            <p className="c3-m">
              {c.wkPrescribed(x.sets.length, x.prescribed.sets, x.prescribed.reps)}
            </p>
          )}
          <DataTable
            bare
            label={c.wkGridLabel(x.name)}
            columns={cols}
            rows={x.sets.map((s, k) => ({ n: k + 1, s }))}
            rowKey={(r) => String(r.n)}
          />
        </section>
      ))}
    </div>
  );
}
