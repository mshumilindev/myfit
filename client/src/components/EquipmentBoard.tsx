/**
 * EquipmentBoard — the per-gym inventory board (design EQ-3 + "My Fit · Machine
 * Details" MD-01). Tick the fine-grained equipment a gym has, grouped by
 * category, searchable in any word order (name, aliases, brands, models) and
 * filterable by the muscle it trains ("what here trains my grow muscles?" —
 * wired to Goals via "My focus"). Every tile carries its muscle tags and a
 * Details → into the machine detail. Selections persist via setGymEquipment,
 * which also derives the coarse `inventory` set the "available at your gym"
 * filters use elsewhere.
 */
import { useMemo, useState } from 'react';
import type { Gym } from '../types';
import { setGymEquipment, useStore } from '../store';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { tokenMatch } from '../search';
import { enrichedCatalog, type EquipCategory, type EquipmentItem } from '../data/equipmentCatalog';
import { localizedEquipName, localizedEquipInfo, equipCategoryLabel } from '../data/equipmentI18n';
import { MuscleChip } from './Muscle';
import type { MuscleGroup } from '../data/exercises';
import { focusLists } from '../goals';
import { focusToGroup } from '../data/subregions';
import type { Shell } from '../App';

const CATEGORY_ORDER: EquipCategory[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'plate',
  'rack',
  'bench',
  'machine',
  'plateLoaded',
  'cable',
  'cardio',
  'band',
  'suspension',
  'conditioning',
  'aquatic',
  'recovery',
  'accessory',
  'assessment',
];

// Muscles offered as inventory filters, in display order — intersected with
// what the catalog actually tags so no dead chips appear.
const FILTER_MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'glutes',
  'hamstrings',
  'calves',
  'adductors',
  'abductors',
  'core',
];

export function EquipmentBoard({ gym, shell }: { gym: Gym; shell: Shell }) {
  const { t, locale } = useT();
  const store = useStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<EquipCategory>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(() => new Set(gym.equipmentItems ?? []));
  const [mfilter, setMfilter] = useState<Set<MuscleGroup>>(new Set());

  // Images that 404 at load time fall back to the placeholder.
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const catalog = useMemo(() => enrichedCatalog(), []);

  const filterMuscles = useMemo(() => {
    const present = new Set<MuscleGroup>();
    for (const it of catalog) for (const m of it.muscles) present.add(m);
    return FILTER_MUSCLES.filter((m) => present.has(m));
  }, [catalog]);

  // Group by category, in the fixed display order.
  const groups = useMemo(() => {
    const byCat = new Map<EquipCategory, EquipmentItem[]>();
    for (const it of catalog) {
      const arr = byCat.get(it.category) ?? [];
      arr.push(it);
      byCat.set(it.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      cat: c,
      items: byCat.get(c)!,
    }));
  }, [catalog]);

  // Search haystack: localized name + English name + aliases + brands + models.
  const hay = (it: EquipmentItem): string =>
    [
      localizedEquipName(it, locale),
      it.name,
      (it.aka ?? []).join(' '),
      (it.brands ?? []).join(' '),
      (it.models ?? []).map((m) => `${m.brand} ${m.name}`).join(' '),
    ].join(' ');

  const searching = query.trim().length > 0;
  const filtering = mfilter.size > 0;
  const active = searching || filtering;

  const matches = (it: EquipmentItem): boolean =>
    (!searching || tokenMatch(hay(it), query)) &&
    (!filtering || it.muscles.some((m) => mfilter.has(m)));

  const visible = useMemo(
    () =>
      groups
        .map((g) => ({ cat: g.cat, items: active ? g.items.filter(matches) : g.items }))
        .filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, query, locale, mfilter],
  );

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    setGymEquipment(gym.id, [...next]);
  };

  const toggleCat = (c: EquipCategory) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const toggleMuscle = (m: MuscleGroup) =>
    setMfilter((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  const growGroups = useMemo(() => focusLists(store.goals).grow.map(focusToGroup), [store.goals]);
  const loadFocus = () => setMfilter(new Set(growGroups.filter((m) => filterMuscles.includes(m))));

  const openDetail = (id: string) =>
    shell.openOverlay({ screen: 'equipment', itemId: id, gymId: gym.id });

  const total = picked.size;
  const matchCount = visible.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="detail-card eq-board">
      <div className="detail-card-head">
        <span className="label">
          <Icon name="scales" /> {t.inventoryLabel}
        </span>
        {total > 0 && <span className="eq-count-badge">{total}</span>}
      </div>
      <div className="detail-muted eq-hint">{t.inventoryNote}</div>

      <div className="eq-search">
        <Icon name="magnifying-glass" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.equipSearchPlaceholder}
          aria-label={t.equipSearchPlaceholder}
        />
        {query && (
          <button className="eq-search-clear" onClick={() => setQuery('')} aria-label={t.srClose}>
            <Icon name="x" />
          </button>
        )}
      </div>

      <div className="eq-filter">
        {growGroups.length > 0 && (
          <button className="eq-focus-pill" onClick={loadFocus}>
            <Icon name="crosshair" weight="fill" /> {t.eqMyFocus}
          </button>
        )}
        {filterMuscles.map((m) => (
          <span key={m} className={`eq-fchip${mfilter.has(m) ? ' on' : ''}`}>
            <MuscleChip
              muscle={m}
              tone={mfilter.has(m) ? 'primary' : 'secondary'}
              onClick={toggleMuscle}
            />
          </span>
        ))}
        {filtering && (
          <button className="eq-clear" onClick={() => setMfilter(new Set())}>
            {t.eqClearFilter}
          </button>
        )}
      </div>
      {filtering && (
        <div className="detail-muted eq-hint eq-matchline">
          {matchCount} {t.eqMatch}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="detail-muted eq-empty">—</div>
      ) : (
        <div className="eq-cats">
          {visible.map(({ cat, items }) => {
            const sel = items.reduce((n, it) => n + (picked.has(it.id) ? 1 : 0), 0);
            const expanded = active || open.has(cat);
            return (
              <div className={`eq-cat${expanded ? ' open' : ''}`} key={cat}>
                <button
                  className="eq-cat-head"
                  onClick={() => toggleCat(cat)}
                  aria-expanded={expanded}
                >
                  <Icon name={expanded ? 'caret-down' : 'arrow-right'} />
                  <span className="eq-cat-label">{equipCategoryLabel(cat, locale)}</span>
                  <span className="eq-cat-count">
                    {sel > 0 ? `${sel}/${items.length}` : items.length}
                  </span>
                </button>
                {expanded && (
                  <div className="eq-grid">
                    {items.map((it) => {
                      const on = picked.has(it.id);
                      const info = localizedEquipInfo(it, locale);
                      return (
                        <div className={`eq-tile${on ? ' on' : ''}`} key={it.id}>
                          <button
                            className="eq-tile-main"
                            onClick={() => toggle(it.id)}
                            aria-pressed={on}
                            title={info}
                          >
                            <span className="eq-thumb">
                              {it.image && !broken.has(it.id) ? (
                                <img
                                  src={it.image.thumbUrl}
                                  alt=""
                                  loading="lazy"
                                  onError={() => setBroken((prev) => new Set(prev).add(it.id))}
                                />
                              ) : (
                                <span className="eq-thumb-ph" aria-hidden />
                              )}
                              {on && (
                                <span className="eq-tile-check">
                                  <Icon name="check" weight="bold" />
                                </span>
                              )}
                            </span>
                            <span className="eq-tile-name">{localizedEquipName(it, locale)}</span>
                            {it.muscles.length > 0 && (
                              <span className="eq-tile-mus">
                                {it.muscles.slice(0, 2).map((m) => (
                                  <MuscleChip key={m} muscle={m} tone="primary" />
                                ))}
                              </span>
                            )}
                          </button>
                          <button className="eq-tile-details" onClick={() => openDetail(it.id)}>
                            {t.eqDetails} <Icon name="arrow-right" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
