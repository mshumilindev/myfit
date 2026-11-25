import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { ActiveFilters } from '../components/ui/ActiveFilters';
import { CatalogCard } from '../components/ui/CatalogCard';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHead } from '../components/ui/PageHead';
import { SearchField } from '../components/ui/SearchField';
import { useAddonOrBase } from '../addons/enabledSet';
import { useAddonStoreT } from '../i18n/addonStore';
import { useT } from '../i18n';
import { CATALOG } from './catalog';
import type { CatalogEntry, CatalogNeed } from './catalog/types';
import { CatalogDetail } from './CatalogDetail';
import { FilterSheet } from './FilterSheet';
import {
  EMPTY_FILTERS,
  FACET_GROUPS,
  activeCount,
  applyFilters,
  hasAnyFilter,
  missingNeeds,
  sortEntries,
  toggleFacet,
  type FilterState,
} from './filters';
import { metaLine } from './meta';
import { STRINGS } from './strings';
import './trainLikeAPro.css';

/**
 * The Train like a pro catalog (overlay of Programs): search, filters and a grid of programs; a tap opens the program.
 * Programs that need an add-on that is not installed are listed with a "Needs …" tag and open read-only.
 */
export function CatalogPage(p: {
  onClose: () => void;
  onStart?: (e: CatalogEntry) => void;
  onGetAddon?: (id: CatalogNeed) => void;
  heldHint?: string;
  starting?: boolean;
  note?: string;
}) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const { st } = useAddonStoreT();
  const periodization = useAddonOrBase('periodization');
  const supersets = useAddonOrBase('supersets');
  const installed = useMemo(() => {
    const set = new Set<string>();
    if (periodization) set.add('periodization');
    if (supersets) set.add('supersets');
    return set;
  }, [periodization, supersets]);

  const [state, setState] = useState<FilterState>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => sortEntries(CATALOG, installed), [installed]);
  const shown = useMemo(() => applyFilters(sorted, state), [sorted, state]);
  const open = openId ? CATALOG.find((e) => e.id === openId) : undefined;

  if (open)
    return (
      <CatalogDetail
        entry={open}
        installed={installed}
        s={s}
        heldHint={p.heldHint}
        starting={p.starting}
        note={p.note}
        onBack={() => setOpenId(null)}
        onStart={p.onStart}
        onGetAddon={p.onGetAddon}
      />
    );

  const chips = FACET_GROUPS.flatMap((g) =>
    state[g].map((id) => ({
      id: `${g}:${id}`,
      label: (s[g] as Record<string, string>)[id],
    })),
  );
  const n = activeCount(state);

  return (
    <div className="screen">
      <div className="tl-page">
        <PageHead
          back={{ label: s.back, onClick: p.onClose }}
          title={s.name}
          sub={s.count(shown.length)}
        />
        <div className="tl-tools">
          <SearchField
            value={state.q}
            onChange={(q) => setState({ ...state, q })}
            placeholder={s.search}
            clearLabel={s.clearSearch}
          />
          <Button variant="secondary" icon="sliders-horizontal" onClick={() => setSheet(true)}>
            {n ? s.filtersOn(n) : s.filters}
          </Button>
        </div>
        <ActiveFilters
          items={chips}
          groupLabel={s.activeFilters}
          clearLabel={s.clearAll}
          removeLabel={s.remove}
          onRemove={(id) => {
            const [g, ...rest] = id.split(':');
            setState(toggleFacet(state, g as (typeof FACET_GROUPS)[number], rest.join(':')));
          }}
          onClear={() => setState({ ...EMPTY_FILTERS, q: state.q })}
        />
        {shown.length === 0 ? (
          <EmptyState icon="magnifying-glass" title={s.emptyTitle} body={s.emptyBody} centered>
            {hasAnyFilter(state) && (
              <Button variant="secondary" onClick={() => setState(EMPTY_FILTERS)}>
                {s.clearAll}
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="tl-grid">
            {shown.map((e) => {
              const missing = missingNeeds(e, installed);
              return (
                <CatalogCard
                  key={e.id}
                  who={e.who}
                  title={e.title}
                  meta={metaLine(e, s)}
                  lockedLabel={missing.length ? s.needs(st.items[missing[0]].name) : undefined}
                  onClick={() => setOpenId(e.id)}
                />
              );
            })}
          </div>
        )}
      </div>
      {sheet && (
        <FilterSheet
          entries={sorted}
          state={state}
          s={s}
          onChange={setState}
          onClose={() => setSheet(false)}
        />
      )}
    </div>
  );
}
