import type { RowStatus } from '../../../components/ui/RosterRows';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { RosterRow } from '../../domain/roster';
import { modeLabel, statusLabel } from '../format';

export type SortKey = 'status' | 'name' | 'week' | 'last';
export const RANK: Record<RowStatus, number> = { urgent: 0, watch: 1, good: 2, none: 3 };
export interface RosterFilter {
  program: string;
  gym: string;
  mode: string;
}
export const NO_FILTER: RosterFilter = { program: 'all', gym: 'all', mode: 'all' };

/** The visible roster: attention view, search, filters, then the sort (status order ties: bigger plan, then name). */
export function filterSortRoster(
  clients: readonly RosterRow[],
  o: { q: string; view: 'all' | 'attn'; fl: RosterFilter; sortK: SortKey },
): RosterRow[] {
  const { q, view, fl, sortK } = o;
  const needle = q.trim().toLowerCase();
  const out = clients.filter(
    ({ client: c, status }) =>
      (view === 'all' || status === 'urgent' || status === 'watch') &&
      (!needle ||
        c.name.toLowerCase().includes(needle) ||
        c.program.toLowerCase().includes(needle)) &&
      (fl.program === 'all' || c.program === fl.program) &&
      (fl.gym === 'all' || c.gym === fl.gym) &&
      (fl.mode === 'all' || c.mode === fl.mode),
  );
  const key = (x: RosterRow): number | string =>
    sortK === 'name'
      ? x.client.name
      : sortK === 'week'
        ? x.client.planned
          ? x.client.done / x.client.planned
          : 0
        : sortK === 'last'
          ? -(x.client.lastSessionAt ?? 0)
          : RANK[x.status];
  return [...out].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return typeof x === 'string'
      ? x.localeCompare(String(y))
      : (x as number) - (y as number) ||
          // same status: the bigger weekly plan first (lab order: Oleh 4x leads), then by name
          (sortK === 'status' ? b.client.planned - a.client.planned : 0) ||
          a.client.name.localeCompare(b.client.name);
  });
}

/** Saves a CSV (UTF-8 with BOM) through a temporary link. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** CSV rows of the roster export: the header, then name / program / week / status / logging per client. */
export function rosterCsvRows(r: RosterStrings, src: readonly RosterRow[]): string[][] {
  return [
    [...r.roCsvCols],
    ...src.map(({ client: c, status }) => [
      c.name,
      c.program,
      c.mode === 'program' ? r.c3NotLogged : r.roWeek(c.done, c.planned),
      statusLabel(r, status),
      modeLabel(r, c.mode),
    ]),
  ];
}
