/**
 * EquipmentBoard — the per-gym inventory board (design EQ-3, front end).
 *
 * Lets the user tick the fine-grained equipment a gym actually has, grouped by
 * category, searchable in any word order (name, aliases, brands, model lines).
 * Selections persist via setGymEquipment, which also derives the coarse
 * `inventory` set that powers the "available at your gym" filters elsewhere.
 */
import { useMemo, useState } from 'react';
import type { Gym } from '../types';
import { setGymEquipment } from '../store';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { tokenMatch } from '../search';
import { enrichedCatalog, type EquipCategory, type EquipmentItem } from '../data/equipmentCatalog';
import { localizedEquipName, localizedEquipInfo, equipCategoryLabel } from '../data/equipmentI18n';

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

export function EquipmentBoard({ gym }: { gym: Gym }) {
  const { t, locale } = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<EquipCategory>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(() => new Set(gym.equipmentItems ?? []));

  const catalog = useMemo(() => enrichedCatalog(), []);

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

  const visible = useMemo(
    () =>
      groups
        .map((g) => ({
          cat: g.cat,
          items: searching ? g.items.filter((it) => tokenMatch(hay(it), query)) : g.items,
        }))
        .filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, query, locale],
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

  const total = picked.size;

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

      {visible.length === 0 ? (
        <div className="detail-muted eq-empty">—</div>
      ) : (
        <div className="eq-cats">
          {visible.map(({ cat, items }) => {
            const sel = items.reduce((n, it) => n + (picked.has(it.id) ? 1 : 0), 0);
            const expanded = searching || open.has(cat);
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
                        <button
                          key={it.id}
                          className={`eq-tile${on ? ' on' : ''}`}
                          onClick={() => toggle(it.id)}
                          aria-pressed={on}
                          title={info}
                        >
                          <span className="eq-thumb">
                            {it.image ? (
                              <img src={it.image.thumbUrl} alt="" loading="lazy" />
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
                        </button>
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
