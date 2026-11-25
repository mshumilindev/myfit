import { Button } from '../components/ui/Button';
import { FilterGroup } from '../components/ui/FilterGroup';
import { Sheet, SheetFoot, SheetPin } from '../components/ui/Overlays';
import type { CatalogEntry } from './catalog/types';
import {
  DAYS_BUCKETS,
  GEAR_TIERS,
  applyFilters,
  facetCounts,
  hasAnyFilter,
  toggleFacet,
  EMPTY_FILTERS,
  type FacetGroup,
  type FilterState,
} from './filters';
import type { TlStrings } from './strings';

const GOALS = ['mass', 'strength', 'shape', 'general'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite'] as const;
const ERAS = [
  'pre-1940',
  'golden-age',
  'arnold-era',
  'mass-monsters',
  'modern',
  'current',
  'unknown',
] as const;
const ORIGINS = ['official', 'book', 'media'] as const;

/** The filter drawer: four main groups, then period and source. The foot shows how many programs the filters give. */
export function FilterSheet(p: {
  entries: readonly CatalogEntry[];
  state: FilterState;
  s: TlStrings;
  onChange: (next: FilterState) => void;
  onClose: () => void;
}) {
  const { entries, state, s } = p;
  const group = (g: FacetGroup, ids: readonly string[], labels: Record<string, string>) => {
    const counts = facetCounts(entries, state, g);
    return (
      <FilterGroup
        key={g}
        label={s.groups[g]}
        options={ids.map((id) => ({ id, label: labels[id], count: counts[id] ?? 0 }))}
        active={state[g]}
        onToggle={(id) => p.onChange(toggleFacet(state, g, id))}
      />
    );
  };
  const n = applyFilters(entries, state).length;
  return (
    <Sheet onClose={p.onClose} label={s.filters} closeLabel={s.back}>
      <SheetPin>
        <h3 className="title-20">{s.filters}</h3>
      </SheetPin>
      <div className="tl-sheet">
        {group('goal', GOALS, s.goal)}
        {group('level', LEVELS, s.level)}
        {group('days', DAYS_BUCKETS, s.days)}
        {group('gear', GEAR_TIERS, s.gear)}
        {group('era', ERAS, s.era)}
        {group('origin', ORIGINS, s.origin)}
      </div>
      <SheetFoot>
        {hasAnyFilter(state) && (
          <Button variant="ghost" onClick={() => p.onChange({ ...EMPTY_FILTERS, q: state.q })}>
            {s.clearAll}
          </Button>
        )}
        <Button onClick={p.onClose} disabled={n === 0}>
          {s.showN(n)}
        </Button>
      </SheetFoot>
    </Sheet>
  );
}
