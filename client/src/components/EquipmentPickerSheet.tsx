/**
 * EquipmentPickerSheet — pick the equipment used for one exercise in a session
 * (design Load-entry / MD-08). A combination is allowed: straps + bar + belt, a
 * band, etc. Suggests what this gym already has (relevant kit first), lets you
 * change it, and — when the gym doesn't have something — search the whole
 * catalog and add it; adding here stocks the gym too.
 */
import { useMemo, useState } from 'react';
import type { Gym, Exercise } from '../types';
import { enrichedCatalog, type EquipmentItem } from '../data/equipmentCatalog';
import { localizedEquipName, equipCategoryLabel } from '../data/equipmentI18n';
import { equipmentFor, setExerciseEquipmentItems } from '../store';
import { useT } from '../i18n';
import { tokenMatch } from '../search';
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

  const selected = exercise.equipmentItems ?? [];
  const gymItems = useMemo(() => gym?.equipmentItems ?? [], [gym]);
  const classes = useMemo(() => new Set(equipmentFor(exercise)), [exercise]);

  const commit = (items: string[]) =>
    setExerciseEquipmentItems(workoutId, exercise.id, items, gym?.id);
  const toggle = (id: string) =>
    commit(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  // Gym's kit, with the exercise-relevant classes first.
  const gymList = useMemo(() => {
    const items = gymItems.map((id) => byId.get(id)).filter((x): x is EquipmentItem => !!x);
    return items.sort((a, b) => (classes.has(b.cls) ? 1 : 0) - (classes.has(a.cls) ? 1 : 0));
  }, [gymItems, byId, classes]);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    return catalog
      .filter((it) =>
        tokenMatch(
          [
            localizedEquipName(it, locale),
            it.name,
            (it.aka ?? []).join(' '),
            (it.brands ?? []).join(' '),
          ].join(' '),
          query,
        ),
      )
      .slice(0, 25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, catalog, locale]);

  const row = (it: EquipmentItem) => {
    const on = selected.includes(it.id);
    const inGym = gymItems.includes(it.id);
    return (
      <button
        key={it.id}
        className={`ep-row${on ? ' on' : ''}`}
        onClick={() => toggle(it.id)}
        aria-pressed={on}
      >
        <span className="ep-row-body">
          <span className="ep-row-name">{localizedEquipName(it, locale)}</span>
          <span className="ep-row-meta">
            {equipCategoryLabel(it.category, locale)}
            {!inGym && ` · ${t.eqAddToGym}`}
          </span>
        </span>
        <Icon name={on ? 'check' : 'plus'} weight="bold" />
      </button>
    );
  };

  return (
    <Sheet onClose={onClose} className="equip-picker">
      <div className="ep-title">{t.eqEquipment}</div>

      {selected.length > 0 && (
        <div className="ep-selected">
          {selected.map((id) => {
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

      {searching ? (
        <div className="ep-list">
          {results.length > 0 ? results.map(row) : <div className="detail-muted ep-empty">—</div>}
        </div>
      ) : (
        <>
          <div className="ep-label">{t.eqInThisGym}</div>
          <div className="ep-list">
            {gymList.length > 0 ? (
              gymList.map(row)
            ) : (
              <div className="detail-muted ep-empty">{t.eqPickSearchHint}</div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
