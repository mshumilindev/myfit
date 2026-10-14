import { Select } from '../../../components/ui/Select';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { RosterFilter, SortKey } from './rosterLogic';

/** Sort and filter selects (program, gym, logging mode) of the roster. */
export function RosterFilters(p: {
  r: RosterStrings;
  sortK: SortKey;
  onSort: (k: SortKey) => void;
  fl: RosterFilter;
  onFilter: (f: RosterFilter) => void;
  programs: readonly string[];
  gyms: readonly string[];
}) {
  return (
    <div className="ro-filters">
      <Select
        aria-label={p.r.roSortLabel}
        value={p.sortK}
        onChange={(e) => p.onSort(e.target.value as SortKey)}
      >
        <option value="status">{p.r.roSortStatus}</option>
        <option value="name">{p.r.roSortName}</option>
        <option value="week">{p.r.roSortWeek}</option>
        <option value="last">{p.r.roSortLast}</option>
      </Select>
      <Select
        aria-label={p.r.roProgramLabel}
        value={p.fl.program}
        onChange={(e) => p.onFilter({ ...p.fl, program: e.target.value })}
      >
        <option value="all">{p.r.roAllPrograms}</option>
        {p.programs.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select
        aria-label={p.r.roGymLabel}
        value={p.fl.gym}
        onChange={(e) => p.onFilter({ ...p.fl, gym: e.target.value })}
      >
        <option value="all">{p.r.roAllGyms}</option>
        {p.gyms.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select
        aria-label={p.r.roLoggingLabel}
        value={p.fl.mode}
        onChange={(e) => p.onFilter({ ...p.fl, mode: e.target.value })}
      >
        <option value="all">{p.r.roAllLogging}</option>
        <option value="app">{p.r.ivApp}</option>
        <option value="hybrid">{p.r.ivHybrid}</option>
        <option value="program">{p.r.ivProgram}</option>
      </Select>
    </div>
  );
}
