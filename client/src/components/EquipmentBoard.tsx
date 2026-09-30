/**
 * EquipmentBoard — the per-gym inventory board ("My Fit · Machine Details"
 * MD-01). Tick the equipment a gym has, grouped by category, searchable in any
 * word order (name, aliases, brands, models) and filterable by the muscle it
 * trains (behind a funnel toggle; "My focus" loads the block's grow muscles
 * from Goals). Every tile carries its muscle tags, taps into the machine
 * detail, and has a corner control to add/remove it from this gym. Selections
 * persist via setGymEquipment, which also derives the coarse `inventory` set the
 * "available at your gym" filters use elsewhere.
 */
import { useMemo, useState } from 'react';
import { Button, IconButton } from './ui/Button';
import { Card } from './ui/Card';
import { Chip } from './ui/Chip';
import { ListRow } from './ui/GroupedList';
import { SearchField } from './ui/SearchField';
import type { Gym } from '../types';
import { setGymEquipment, useStore } from '../store';
import { useT } from '../i18n';
import { ConfirmDialog, Icon, Sheet } from '../ui';
import { tokenMatch } from '../search';
import { enrichedCatalog, type EquipCategory, type EquipmentItem } from '../data/equipmentCatalog';
import { localizedEquipName, localizedEquipInfo, equipCategoryLabel } from '../data/equipmentI18n';
import { MuscleChip } from './Muscle';
import type { MuscleGroup } from '../data/exercises';
import { focusLists } from '../goals';
import { focusToGroup } from '../data/subregions';
import type { Shell } from '../App';
import { Tag } from './ui/Tag';

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
  const [showFilters, setShowFilters] = useState(false);
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'one'; id: string } | { kind: 'all' } | null>(
    null,
  );

  // Images that 404 at load time fall back to the placeholder.
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const catalog = useMemo(() => enrichedCatalog(), []);
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);

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

  // Remove one picked item (from the "selected" sheet) — reversible via snackbar.
  const removeOne = (id: string) => {
    const it = byId.get(id);
    const prev = new Set(picked);
    const next = new Set(picked);
    next.delete(id);
    setPicked(next);
    setGymEquipment(gym.id, [...next]);
    if (next.size === 0) setManage(false);
    shell.snack({
      text: t.eqRemovedSnack(it ? localizedEquipName(it, locale) : id),
      onUndo: () => {
        setPicked(prev);
        setGymEquipment(gym.id, [...prev]);
      },
    });
  };

  const clearAll = () => {
    const prev = new Set(picked);
    setPicked(new Set());
    setGymEquipment(gym.id, []);
    setManage(false);
    shell.snack({
      text: t.eqClearedSnack(prev.size),
      onUndo: () => {
        setPicked(prev);
        setGymEquipment(gym.id, [...prev]);
      },
    });
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
        {total > 0 && (
          <Chip
            tone="accent"
            size="sm"
            onClick={() => setManage(true)}
            aria-label={t.eqSelectedTitle}
          >
            {total}
          </Chip>
        )}
      </div>
      <div className="detail-muted eq-hint">{t.inventoryNote}</div>

      <div className="eq-searchrow">
        <div className="eq-search-wrap">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t.equipSearchPlaceholder}
            clearLabel={t.srClose}
          />
        </div>
        {filterMuscles.length > 0 && (
          <Button
            variant={filtering ? 'primary' : 'secondary'}
            className="eq-funnel-btn"
            icon="funnel-simple"
            onClick={() => setShowFilters((v) => !v)}
            aria-label={t.eqFilterByMuscle}
            aria-expanded={showFilters}
          >
            {filtering ? <span className="eq-funnel-n">{mfilter.size}</span> : null}
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="eq-filter">
          {growGroups.length > 0 && (
            <Button variant="secondary" size="sm" icon="crosshair" onClick={loadFocus}>
              {t.eqMyFocus}
            </Button>
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
            <Button variant="link" size="sm" onClick={() => setMfilter(new Set())}>
              {t.eqClearFilter}
            </Button>
          )}
        </div>
      )}

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
                <ListRow
                  dense
                  strong
                  icon={<Icon name={expanded ? 'caret-down' : 'arrow-right'} />}
                  label={equipCategoryLabel(cat, locale)}
                  value={sel > 0 ? `${sel}/${items.length}` : items.length}
                  onClick={() => toggleCat(cat)}
                  aria-expanded={expanded}
                />
                {expanded && (
                  <div className="eq-grid">
                    {items.map((it) => {
                      const on = picked.has(it.id);
                      const info = localizedEquipInfo(it, locale);
                      return (
                        <div className={`eq-tile${on ? ' on' : ''}`} key={it.id}>
                          <Card
                            as="button"
                            pad="none"
                            emphasis="quiet"
                            className="eq-tile-main"
                            onClick={() => openDetail(it.id)}
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
                            </span>
                            <span className="eq-tile-name">{localizedEquipName(it, locale)}</span>
                            {it.muscles.length > 0 && (
                              <span className="eq-tile-mus">
                                {it.muscles.slice(0, 2).map((m) => (
                                  <MuscleChip key={m} muscle={m} tone="primary" />
                                ))}
                              </span>
                            )}
                          </Card>
                          <IconButton
                            icon={on ? 'check' : 'plus'}
                            variant={on ? 'primary' : 'secondary'}
                            size="sm"
                            className="eq-tile-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(it.id);
                            }}
                            aria-pressed={on}
                            label={on ? t.eqInThisGym : t.add}
                          />
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

      {manage && (
        <Sheet onClose={() => setManage(false)} className="eq-manage">
          <div className="ep-title">
            {t.eqSelectedTitle} <Tag tone="neutral">{total}</Tag>
          </div>
          <div className="eq-manage-list">
            {[...picked]
              .map((id) => byId.get(id))
              .filter((x): x is EquipmentItem => !!x)
              .sort((a, b) =>
                localizedEquipName(a, locale).localeCompare(localizedEquipName(b, locale)),
              )
              .map((it) => (
                <div className="eq-manage-row" key={it.id}>
                  <span className="eq-manage-thumb">
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
                  </span>
                  <span className="eq-manage-name">{localizedEquipName(it, locale)}</span>
                  <IconButton
                    icon="x"
                    size="sm"
                    className="eq-manage-btn"
                    onClick={() => setConfirm({ kind: 'one', id: it.id })}
                    label={t.eqRemove}
                  />
                </div>
              ))}
          </div>
          <Button
            variant="danger"
            className="eq-clear-all"
            onClick={() => setConfirm({ kind: 'all' })}
          >
            <Icon name="trash" /> {t.eqClearAll}
          </Button>
        </Sheet>
      )}

      {confirm?.kind === 'one' &&
        (() => {
          const it = byId.get(confirm.id);
          return (
            <ConfirmDialog
              title={t.eqRemoveOneTitle}
              body={t.eqRemoveOneBody(it ? localizedEquipName(it, locale) : confirm.id)}
              confirmLabel={t.eqRemove}
              cancelLabel={t.cancel}
              danger
              onConfirm={() => {
                removeOne(confirm.id);
                setConfirm(null);
              }}
              onCancel={() => setConfirm(null)}
            />
          );
        })()}

      {confirm?.kind === 'all' && (
        <ConfirmDialog
          title={t.eqClearAllTitle}
          body={t.eqClearAllBody(total)}
          confirmLabel={t.eqClearAll}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            clearAll();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
