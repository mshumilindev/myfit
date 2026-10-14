import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { RosterStrings } from '../../../i18n/coachRoster';

/** Nothing matches the search or filters: say so and offer to clear. */
export function RosterNoMatch(p: {
  r: RosterStrings;
  q: string;
  filtering: boolean;
  onClear: () => void;
}) {
  const { r, q } = p;
  return (
    <Card>
      <EmptyState titleAs="h2" icon="magnifying-glass" title={q ? r.roNoMatch(q) : r.roNoFilter}>
        <Button variant="secondary" onClick={p.onClear}>
          {q && !p.filtering ? r.roClearSearch : r.roClearFilters}
        </Button>
      </EmptyState>
    </Card>
  );
}
