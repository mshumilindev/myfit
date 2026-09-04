/**
 * EquipmentPickerSheet — pick the equipment used for one exercise in a session
 * (design Load-entry / MD-08). Same tile layout as the gym inventory board
 * (photo, name, muscle tags) but without the Details jump, and scoped to the
 * equipment CATEGORIES that make sense for this exercise (pickerCategoriesFor-
 * Exercise). A combination is allowed — straps + bar + belt, a band, any mix.
 * Adding something the gym doesn't have stocks the gym too.
 */
import { useMemo, useState } from 'react';
import type { Gym, Exercise } from '../types';
import {
  enrichedCatalog,
  equipmentItemFitsExercise,
  pickerCategoriesForExercise,
  primaryCategoriesForExercise,
  type EquipCategory,
  type EquipmentItem,
} from '../data/equipmentCatalog';
import type { MuscleGroup } from '../data/exercises';
import { localizedEquipName, equipCategoryLabel } from '../data/equipmentI18n';
import { equipmentFor, resolveMuscles, setExerciseEquipmentItems } from '../store';
import { useT } from '../i18n';
import { tokenMatch } from '../search';
import { MuscleChip } from './Muscle';
import { Icon, Sheet } from '../ui';

export function EquipmentPickerSheet({
  workoutId,
  exercise,
  gym,
  onClose,
}: {
  workoutId: string;
  exercise: Exercise;
  gym: Gym | null;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const catalog = useMemo(() => enrichedCatalog(), []);
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<EquipCategory | null>(null);

  const selected = useMemo(() => new Set(exercise.equipmentItems ?? []), [exercise.equipmentItems]);

  // Categories relevant to this exercise's equipment class.
  const classes = useMemo(() => equipmentFor(exercise), [exercise]);
  const cats = useMemo(() => pickerCategoriesForExercise(classes), [classes]);
  const primaryCats = useMemo(() => new Set(primaryCategoriesForExercise(classes)), [classes]);
  const muscles = useMemo(() => {
    const m = resolveMuscles(exercise);
    return [m.primary, ...m.secondary].filter(Boolean) as MuscleGroup[];
  }, [exercise]);

  // Relevant items grouped by category, in the fixed order. Within each category
  // only items that actually fit the exercise are shown (belts/straps for a
  // squat, not ab-wheels) — but an already-selected item is always kept so it
  // can be unpicked, and universal support keeps real alternatives available.
  const groups = useMemo(() => {
    const allow = new Set(cats);
    const byCat = new Map<EquipCategory, EquipmentItem[]>();
    for (const it of catalog) {
      if (!allow.has(it.category)) continue;
      if (
        !selected.has(it.id) &&
        !equipmentItemFitsExercise(it, { classes, muscles, primaryCategories: primaryCats })
      ) {
        continue;
      }
      const arr = byCat.get(it.category) ?? [];
      arr.push(it);
      byCat.set(it.category, arr);
    }
    return cats.filter((c) => byCat.has(c)).map((c) => ({ cat: c, items: byCat.get(c)! }));
  }, [catalog, cats, classes, muscles, primaryCats, selected]);

  const hay = (it: EquipmentItem): string =>
    [
      localizedEquipName(it, locale),
      it.name,
      (it.aka ?? []).join(' '),
      (it.brands ?? []).join(' '),
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

  const gymItems = gym?.equipmentItems ?? [];
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExerciseEquipmentItems(workoutId, exercise.id, [...next], gym?.id);
  };
  const toggleCat = (c: EquipCategory) => setOpen((prev) => (prev === c ? null : c));

  return (
    <Sheet onClose={onClose} className="equip-picker">
      <div className="ep-title">{t.eqEquipment}</div>

      {selected.size > 0 && (
        <div className="ep-selected">
          {[...selected].map((id) => {
            const it = byId.get(id);
            return (
              <button key={id} className="ep-sel" onClick={() => toggle(id)}>
                {it ? localizedEquipName(it, locale) : id}
                <Icon name="x" />
              </button>
            );
          })}
        </div>
      )}

      <div className="eq-search ep-search">
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

      <div className="ep-scroll eq-cats">
        {visible.length === 0 ? (
          <div className="detail-muted ep-empty">—</div>
        ) : (
          visible.map(({ cat, items }) => {
            const sel = items.reduce((n, it) => n + (selected.has(it.id) ? 1 : 0), 0);
            const expanded = searching || open === cat;
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
                      const on = selected.has(it.id);
                      const inGym = gymItems.includes(it.id);
                      return (
                        <button
                          key={it.id}
                          className={`eq-tile eq-pick-tile${on ? ' on' : ''}`}
                          onClick={() => toggle(it.id)}
                          aria-pressed={on}
                          title={localizedEquipName(it, locale)}
                        >
                          <span className="eq-thumb">
                            {it.image ? (
                              <img
                                src={it.image.thumbUrl}
                                alt=""
                                loading="lazy"
                                onError={hideBroken}
                              />
                            ) : (
                              <span className="eq-thumb-ph" aria-hidden />
                            )}
                            {on && (
                              <span className="eq-tile-check">
                                <Icon name="check" weight="bold" />
                              </span>
                            )}
                            {!inGym && !on && <span className="eq-tile-add">＋</span>}
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
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = 'none';
};
