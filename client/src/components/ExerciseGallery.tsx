/**
 * Exercise gallery (design LIB-1 phone list, LIB-2 web filter-rail + grid).
 *
 * Web is a left filter rail (muscle group · category · mechanic/force · level ·
 * equipment) beside a paginated 4-column card grid;
 * phone is a search bar with a filter sheet over a list of rows. Every card
 * previews its media — the real form photo (public-domain, landscape) when the
 * base record has one, else a barbell glyph. Classification
 * badges use the shared token grammar (b-cat/b-mech/b-eq/b-mus). The catalogue
 * is bundled static data — pagination + lazy images keep the DOM and image
 * bandwidth small; nothing here touches Firestore. A card opens the detail.
 *
 * Two user additions layer on the design: Library/My-exercises tabs and custom
 * exercise CRUD (create / edit / delete), both URL-addressable.
 */
import { Chip } from '../components/ui/Chip';
import { Tag } from './ui/Tag';
import { BackButton } from './ui/BackButton';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Field } from './ui/Field';
import { Button, IconButton } from './ui/Button';
import { Card } from './ui/Card';
import { SearchField } from './ui/SearchField';
import { Segmented } from './ui/Segmented';
import {
  BUILT_IN_CATALOG,
  canonicalExerciseName,
  exerciseSearchText,
  muscleInfoByName,
  richExerciseByName,
  subRegionsByName,
  secondaryMusclesOf,
  type ExerciseCategory,
  type ExerciseForce,
  type ExerciseLevel,
  type ExerciseMechanic,
  type MuscleGroup,
} from '../data/exercises';
import { SPLIT_GROUPS, type FocusMuscle, type ExerciseSubRegions } from '../data/subregions';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import {
  deleteCatalogExercise,
  knownExercises,
  myExercises,
  saveCatalogExercise,
  updateCatalogExercise,
  useStore,
  type MyExercise,
} from '../store';
import { getRole } from '../api';
import { tokenMatch } from '../search';
import { useT } from '../i18n';
import { ConfirmDialog, ExerciseName, Icon, Sheet, useIsDesktop, useExerciseName } from '../ui';
import { equipmentIconName, MuscleIcon, MUSCLE_IDS } from '../components/Muscle';
import type { Shell } from '../App';

type MediaKind = 'photo' | 'none';

interface Row {
  key: string;
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
  category: ExerciseCategory | null;
  mechanic: ExerciseMechanic | null;
  force: ExerciseForce | null;
  level: ExerciseLevel | null;
  kind: MediaKind;
  image: string | null;
  /** Present on My-exercises rows — the source record for edit/delete. */
  mineRef?: MyExercise;
}

const CATEGORY_IDS: ExerciseCategory[] = [
  'strength',
  'stretching',
  'plyometrics',
  'strongman',
  'powerlifting',
  'cardio',
  'olympic weightlifting',
];
const MECHANIC_IDS: ExerciseMechanic[] = ['compound', 'isolation'];
const FORCE_IDS: ExerciseForce[] = ['push', 'pull', 'static'];
const LEVEL_IDS: ExerciseLevel[] = ['beginner', 'intermediate', 'expert'];

/** Persisted filter state so the tab keeps it across switches (AC-LIBTAB-04). */
export interface GalleryState {
  q: string;
  muscle?: MuscleGroup;
  equip?: EquipmentId;
  category?: ExerciseCategory;
  mechanic?: ExerciseMechanic;
  force?: ExerciseForce;
  level?: ExerciseLevel;
}
const DEFAULT_STATE: GalleryState = { q: '' };

export function ExerciseGallery({
  shell,
  state,
  onState,
  libTab,
  onLibTab,
}: {
  shell: Shell;
  state?: GalleryState;
  onState?: (s: GalleryState) => void;
  /** Controlled Library/My-exercises tab (URL-addressable) + change handler. */
  libTab?: 'library' | 'mine';
  onLibTab?: (t: 'library' | 'mine') => void;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  useStore();
  const isDesktop = useIsDesktop();
  const [local, setLocal] = useState<GalleryState>(state ?? DEFAULT_STATE);
  const s = state ?? local;
  const [page, setPage] = useState(0);
  const set = (patch: Partial<GalleryState>) => {
    const next = { ...s, ...patch };
    if (onState) onState(next);
    else setLocal(next);
    setPage(0);
  };
  const [showFilters, setShowFilters] = useState(false);

  // Library (built-in catalogue) vs My exercises (user-created). The active tab
  // is URL-addressable, so it comes in as a prop when the route carries it.
  const [localTab, setLocalTab] = useState<'library' | 'mine'>('library');
  const tab = libTab ?? localTab;
  const setTab = (next: 'library' | 'mine') => {
    setPage(0);
    if (onLibTab) onLibTab(next);
    else setLocalTab(next);
  };
  const mine = myExercises();
  const canEdit = getRole() === 'admin' || getRole() === 'trainer';
  // Editor sheet: null = closed, {id:null} = create, {id} = edit an existing one.
  const [editing, setEditing] = useState<CustomEditState | null>(null);
  const [deleting, setDeleting] = useState<MyExercise | null>(null);
  const openCreate = () =>
    setEditing({ id: null, name: '', primary: null, secondary: [], equipment: [] });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const c of BUILT_IN_CATALOG) {
      const rich = richExerciseByName(c.names[0]);
      const image = rich?.images?.[0] ?? null;
      out.push({
        key: c.id,
        name: c.names[0],
        primary: c.muscle === 'cardio' ? null : c.muscle,
        secondary: secondaryMusclesOf(c),
        equipment: c.equipment ?? rich?.equipment ?? null,
        category: rich?.category ?? null,
        mechanic: rich?.mechanic ?? null,
        force: rich?.force ?? null,
        level: rich?.level ?? null,
        kind: image ? 'photo' : 'none',
        image,
      });
      for (const n of c.names) seen.add(n.toLowerCase());
    }
    for (const k of knownExercises()) {
      if (seen.has(canonicalExerciseName(k.name).toLowerCase())) continue;
      const info = muscleInfoByName(k.name);
      const rich = richExerciseByName(k.name);
      const image = rich?.images?.[0] ?? null;
      out.push({
        key: `hist-${k.name}`,
        name: k.name,
        primary: info && info.primary !== 'cardio' ? info.primary : null,
        secondary: info?.secondary ?? [],
        equipment: (info?.equipment as EquipmentId | null) ?? rich?.equipment ?? null,
        category: rich?.category ?? null,
        mechanic: rich?.mechanic ?? null,
        force: rich?.force ?? null,
        level: rich?.level ?? null,
        kind: image ? 'photo' : 'none',
        image,
      });
    }
    return out;
  }, []);

  const needle = s.q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            tokenMatch(
              exerciseSearchText(
                r.name,
                [r.primary, ...r.secondary].filter((m): m is MuscleGroup => m !== null),
                r.equipment,
              ),
              needle,
            ) &&
            (s.muscle === undefined || r.primary === s.muscle || r.secondary.includes(s.muscle)) &&
            (s.equip === undefined || r.equipment === s.equip) &&
            (s.category === undefined || r.category === s.category) &&
            (s.mechanic === undefined || r.mechanic === s.mechanic) &&
            (s.force === undefined || r.force === s.force) &&
            (s.level === undefined || r.level === s.level),
        )
        .sort((a, b) => {
          // With a muscle filter on, exercises where it's the PRIMARY mover come
          // first; the ones where it's only secondary fall below (see divider).
          if (s.muscle !== undefined) {
            const ap = a.primary === s.muscle ? 0 : 1;
            const bp = b.primary === s.muscle ? 0 : 1;
            if (ap !== bp) return ap - bp;
          }
          return a.name.localeCompare(b.name);
        }),
    [rows, needle, s.muscle, s.equip, s.category, s.mechanic, s.force, s.level],
  );

  const total = rows.length;
  const richCount = rows.filter((r) => r.image).length;

  // My exercises share the same shell/filters; classification fields are null,
  // so only name + muscle + equipment filter them.
  const isMine = tab === 'mine';
  const mineRows: Row[] = mine.map((e) => ({
    key: `mine-${e.id}`,
    name: e.name,
    primary: e.primaryMuscle,
    secondary: e.secondaryMuscles,
    equipment: (e.equipment[0] as EquipmentId | undefined) ?? null,
    category: null,
    mechanic: null,
    force: null,
    level: null,
    kind: 'none',
    image: null,
    mineRef: e,
  }));
  const mineMatches = mineRows
    .filter(
      (r) =>
        tokenMatch(
          exerciseSearchText(
            r.name,
            [r.primary, ...r.secondary].filter((m): m is MuscleGroup => m !== null),
            r.equipment,
          ),
          needle,
        ) &&
        (s.muscle === undefined || r.primary === s.muscle || r.secondary.includes(s.muscle)) &&
        (s.equip === undefined || r.equipment === s.equip),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const list = isMine ? mineMatches : matches;
  const PAGE = isDesktop ? 24 : 12;
  // Infinite scroll: `page` counts the extra chunks revealed so far.
  const shown = list.slice(0, (page + 1) * PAGE);
  const hasMore = shown.length < list.length;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) setPage((p) => p + 1);
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown.length]);

  const musclesText = (r: Row) =>
    [r.primary, ...r.secondary]
      .filter(Boolean)
      .map((m) => t.muscleGroups[m as MuscleGroup])
      .join(' · ');

  const open = (r: Row) => shell.openOverlay({ screen: 'exercise-detail', name: r.name });

  // --- active filter chips (removable) --------------------------------------
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (s.muscle)
    active.push({
      key: 'mu',
      label: t.muscleGroups[s.muscle],
      clear: () => set({ muscle: undefined }),
    });
  if (s.equip)
    active.push({
      key: 'eq',
      label: t.equipmentNames[s.equip],
      clear: () => set({ equip: undefined }),
    });
  // One filter set drives both subtabs, so every active facet stays visible and
  // removable regardless of which subtab is showing.
  if (s.category)
    active.push({
      key: 'ca',
      label: t.categoryNames[s.category],
      clear: () => set({ category: undefined }),
    });
  if (s.mechanic)
    active.push({
      key: 'mc',
      label: t.mechanicNames[s.mechanic],
      clear: () => set({ mechanic: undefined }),
    });
  if (s.force)
    active.push({
      key: 'fo',
      label: t.forceNames[s.force],
      clear: () => set({ force: undefined }),
    });
  if (s.level)
    active.push({
      key: 'lv',
      label: t.levelNames[s.level],
      clear: () => set({ level: undefined }),
    });
  const activeChips =
    active.length > 0 ? (
      <div className="exl-active">
        {active.map((a) => (
          <Button key={a.key} variant="secondary" size="sm" iconTrailing="x" onClick={a.clear}>
            {a.label}
          </Button>
        ))}
      </div>
    ) : null;

  // --- filter groups (shared: desktop rail + mobile sheet) ------------------
  const chip = (isActive: boolean, label: string, onClick: () => void, key: string) => (
    <Chip key={key} selected={isActive} onClick={onClick}>
      {label}
    </Chip>
  );

  const groups = (
    <>
      <div>
        <div className="exl-group-label">{t.muscleGroupsLabel}</div>
        <div className="exl-chips">
          {MUSCLE_IDS.map((m) =>
            chip(
              s.muscle === m,
              t.muscleGroups[m],
              () => set({ muscle: s.muscle === m ? undefined : m }),
              `mu-${m}`,
            ),
          )}
        </div>
      </div>
      <div>
        <div className="exl-group-label">{t.libCategoryLabel}</div>
        <div className="exl-chips">
          {CATEGORY_IDS.map((c) =>
            chip(
              s.category === c,
              t.categoryNames[c],
              () => set({ category: s.category === c ? undefined : c }),
              `ca-${c}`,
            ),
          )}
        </div>
      </div>
      <div>
        <div className="exl-group-label">{t.libMechForceLabel}</div>
        <div className="exl-chips">
          {MECHANIC_IDS.map((mc) =>
            chip(
              s.mechanic === mc,
              t.mechanicNames[mc],
              () => set({ mechanic: s.mechanic === mc ? undefined : mc }),
              `mc-${mc}`,
            ),
          )}
          {FORCE_IDS.map((f) =>
            chip(
              s.force === f,
              t.forceNames[f],
              () => set({ force: s.force === f ? undefined : f }),
              `fo-${f}`,
            ),
          )}
        </div>
      </div>
      <div>
        <div className="exl-group-label">{t.libLevelLabel}</div>
        <div className="exl-chips">
          {LEVEL_IDS.map((l) =>
            chip(
              s.level === l,
              t.levelNames[l],
              () => set({ level: s.level === l ? undefined : l }),
              `lv-${l}`,
            ),
          )}
        </div>
      </div>
      <div>
        <div className="exl-group-label">{t.equipmentLabelField}</div>
        <div className="exl-chips">
          {EQUIPMENT_IDS.map((id) =>
            chip(
              s.equip === id,
              t.equipmentNames[id],
              () => set({ equip: s.equip === id ? undefined : id }),
              `eq-${id}`,
            ),
          )}
        </div>
      </div>
    </>
  );

  // --- media thumbnail (shared card + row) ----------------------------------
  const media = (r: Row, i: number, cls: 'exl-media' | 'exl-mthumb') => {
    if (r.kind === 'photo') {
      return (
        <div className={`${cls} photo${i % 2 === 1 ? ' alt' : ''}`}>
          {r.image && (
            <img
              src={r.image}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <Icon name="image-square" className="exl-glyph" />
        </div>
      );
    }
    return (
      <div className={cls}>
        <Icon name="barbell" className="exl-noneglyph" />
      </div>
    );
  };

  const pager = hasMore ? (
    <div ref={sentinel} className="exl-more">
      <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
        {t.showMore}
      </Button>
    </div>
  ) : null;

  const card = (r: Row, i: number) => (
    <Card as="button" pad="none" className="exl-card" key={r.key} onClick={() => open(r)}>
      {media(r, i, 'exl-media')}
      <div className="exl-cardbody">
        <div className="exl-cardname">
          <ExerciseName name={r.name} />
        </div>
        <div className="exl-cardmus">{musclesText(r)}</div>
        {/* Always rendered, even when empty: it reserves its own row so a card
            without badges is exactly as tall as one with them. */}
        <div className="exl-cardbadges">
          {r.mechanic && <Tag tone="neutral">{t.mechanicNames[r.mechanic]}</Tag>}
          {r.equipment && (
            <Tag tone="neutral" icon={<Icon name={equipmentIconName(r.equipment)} />}>
              {t.equipmentNames[r.equipment]}
            </Tag>
          )}
        </div>
      </div>
    </Card>
  );

  const listRow = (r: Row, i: number) => (
    <Card as="button" pad="none" key={r.key} className="exl-mrow" onClick={() => open(r)}>
      {media(r, i, 'exl-mthumb')}
      <div className="exl-mbody">
        <div className="exl-mname">
          <ExerciseName name={r.name} />
        </div>
        <div className="exl-mmus">{musclesText(r)}</div>
        <div className="exl-mbadges">
          {r.mechanic && <Tag tone="neutral">{t.mechanicNames[r.mechanic]}</Tag>}
          {r.force && <Tag tone="neutral">{t.forceNames[r.force]}</Tag>}
          {r.equipment && (
            <Tag tone="neutral" icon={<Icon name={equipmentIconName(r.equipment)} />}>
              {t.equipmentNames[r.equipment]}
            </Tag>
          )}
        </div>
      </div>
    </Card>
  );

  // One "New exercise" button, same design + behaviour everywhere. Uses the
  // primary (brass-outlined) style so it reads identically to "New program".
  const newBtn = canEdit ? (
    <Button variant="primary" size="sm" className="exl-new" onClick={openCreate}>
      <Icon name="plus" />
      {t.libCreateExercise}
    </Button>
  ) : null;

  const mineRow = (r: Row) => {
    const e = r.mineRef;
    return (
      <Card key={r.key} pad="none" className="exl-mrow exg-mine-row">
        <Card
          as="button"
          pad="none"
          emphasis="quiet"
          className="exg-mine-open"
          onClick={() => open(r)}
        >
          <div className="exl-mbody">
            <div className="exl-mname">{exName(r.name)}</div>
            <div className="exl-mmus">{musclesText(r) || t.libNoClassInline}</div>
            {r.equipment && (
              <div className="exl-mbadges">
                <Tag tone="neutral" icon={<Icon name={equipmentIconName(r.equipment)} />}>
                  {t.equipmentNames[r.equipment]}
                </Tag>
              </div>
            )}
          </div>
        </Card>
        {canEdit && e && (
          <div className="exg-mine-acts">
            <IconButton
              icon="clock-counter-clockwise"
              size="sm"
              label={t.openHistory}
              title={t.openHistory}
              onClick={() => shell.openOverlay({ screen: 'exercise-history', name: r.name })}
            />
            <IconButton
              icon="pencil-simple"
              size="sm"
              label={t.edit}
              title={t.edit}
              onClick={() =>
                setEditing({
                  // A history-only exercise has no catalogue doc yet — saving
                  // promotes it (id:null → create), so it gains muscles/equipment.
                  id: e.source === 'catalog' ? e.id : null,
                  name: e.name,
                  primary: e.primaryMuscle,
                  secondary: e.secondaryMuscles,
                  equipment: e.equipment,
                })
              }
            />
            {e.source === 'catalog' && (
              <IconButton
                icon="trash"
                variant="danger"
                size="sm"
                label={t.bmRemove}
                title={t.bmRemove}
                onClick={() => setDeleting(e)}
              />
            )}
          </div>
        )}
      </Card>
    );
  };

  // Boundary between primary-muscle matches and secondary-muscle matches in the
  // full sorted list (library only, when a muscle filter is active).
  const secStart =
    !isMine && s.muscle !== undefined ? list.findIndex((r) => r.primary !== s.muscle) : -1;
  const renderPage = (renderFn: (r: Row, i: number) => ReactNode) =>
    shown.flatMap((r, i) => {
      const gIdx = i;
      const out: ReactNode[] = [];
      if (secStart >= 0 && gIdx === secStart) {
        out.push(
          <div key="__secdiv" className="exl-sec-div">
            {t.exlSecondaryFor(t.muscleGroups[s.muscle as MuscleGroup])}
          </div>,
        );
      }
      out.push(renderFn(r, i));
      return out;
    });

  const body =
    isMine && mine.length === 0 ? (
      <div className="exg-mine-empty">{t.libNoCustom}</div>
    ) : isMine ? (
      <div className="exl-mrows">{shown.map(mineRow)}</div>
    ) : isDesktop ? (
      <div className="exl-grid">{renderPage(card)}</div>
    ) : (
      <div className="exl-mrows">{renderPage(listRow)}</div>
    );

  // Library / My-exercises subtabs. They live under the content heading (not in
  // the rail), mirroring how Programs stacks its title and switcher.
  const subTabs = (
    <Segmented
      className="exg-tabs"
      label={t.exercisesTitle}
      value={tab}
      onChange={(v) => setTab(v)}
      options={[
        { value: 'library' as const, label: t.libTabLibrary },
        {
          value: 'mine' as const,
          label: (
            <>
              {t.libTabMine}
              {mine.length > 0 && <Tag tone="neutral">{mine.length}</Tag>}
            </>
          ),
        },
      ]}
    />
  );

  const searchField = (
    <SearchField
      className="exl-search"
      value={s.q}
      onChange={(q) => set({ q })}
      placeholder={t.searchExercises}
      clearLabel={t.srClose}
    />
  );

  // Shared shell for both tabs: filter rail (desktop) / filter sheet (phone),
  // header with the New-exercise button, search, active chips, list, pager.
  // On desktop the rail mirrors the Programs sidebar — title, then search, then
  // the browsable content. On phone the rail is hidden, so search stays in the
  // main column next to the filter-sheet trigger.
  const galleryMain = (
    <div className="exl-shell">
      <aside className="exl-rail">
        <div className="exl-rail-title">{t.libFiltersLabel}</div>
        {isDesktop && searchField}
        {groups}
      </aside>
      <div className="exl-main">
        <div className="exl-head">
          <div className="exl-head-l">
            <h2>{isMine ? t.libTabMine : t.exercisesTitle}</h2>
            <p className="exl-cov">
              {isMine ? t.libMineCount(mine.length) : t.libCoverage(total, richCount)}
            </p>
          </div>
          {newBtn}
        </div>
        {subTabs}
        {!isDesktop && (
          <div className="exl-searchrow">
            {searchField}
            <IconButton
              icon="funnel-simple"
              className="exl-funnel"
              variant={active.length > 0 ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(true)}
              label={t.libFiltersLabel}
            />
          </div>
        )}
        {activeChips}
        {body}
        {pager}
      </div>
    </div>
  );

  return (
    <div className={`exl${isDesktop ? ' desktop' : ''}`}>
      {galleryMain}

      {showFilters && (
        <Sheet onClose={() => setShowFilters(false)} className="new-exercise-sheet">
          <div className="sheet-head with-back">
            <BackButton
              className="sheet-back"
              label={t.backAction}
              onClick={() => setShowFilters(false)}
            />
            <span className="t">{t.libFiltersLabel}</span>
          </div>
          <div className="exl-fsheet">{groups}</div>
        </Sheet>
      )}

      {editing && (
        <CustomEditor
          init={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const meta = {
              name: v.name.trim(),
              kind: 'strength',
              primaryMuscle: v.primary,
              secondaryMuscles: v.secondary,
              equipment: v.equipment,
              subRegions: v.subRegions,
            };
            if (editing.id) updateCatalogExercise(editing.id, meta);
            else saveCatalogExercise(meta);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t.libDeleteTitle(deleting.name)}
          body={t.libDeleteBody}
          confirmLabel={t.bmRemove}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteCatalogExercise(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export interface CustomEditState {
  id: string | null;
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string[];
  subRegions?: ExerciseSubRegions;
}

/** Create / edit a custom exercise: name + primary + secondary + equipment.
 *  Save is the confirmation step (an edit only lands when Save is pressed). */
export function CustomEditor(props: {
  init: CustomEditState;
  onClose: () => void;
  onSave: (v: CustomEditState) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(props.init.name);
  const [primary, setPrimary] = useState<MuscleGroup | null>(props.init.primary);
  const [secondary, setSecondary] = useState<MuscleGroup[]>(props.init.secondary);
  const [equipment, setEquipment] = useState<string[]>(props.init.equipment);
  // Fine sub-regions (chest/shoulder only). Prefill from the edited exercise or,
  // failing that, the built-in overlay for a library lift being cloned.
  const initSR = props.init.subRegions ?? subRegionsByName(props.init.name) ?? undefined;
  const [subPrimary, setSubPrimary] = useState<FocusMuscle[]>(initSR?.primary ?? []);
  const [subSecondary, setSubSecondary] = useState<FocusMuscle[]>(initSR?.secondary ?? []);
  const primarySplit: FocusMuscle[] = primary ? (SPLIT_GROUPS[primary] ?? []) : [];
  const secondarySplit: FocusMuscle[] = secondary.flatMap((m) => SPLIT_GROUPS[m] ?? []);
  const toggle = (set: React.Dispatch<React.SetStateAction<FocusMuscle[]>>, f: FocusMuscle) =>
    set((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]));
  const ready = name.trim().length > 0;

  return (
    <Sheet onClose={props.onClose} className="new-exercise-sheet">
      <div className="sheet-head">
        <span className="t">{props.init.id ? t.libEditExercise : t.libCreateExercise}</span>
      </div>

      <label className="bm-field">
        <span className="bm-field-label">{t.exerciseNameLabel}</span>
        <Field
          autoFocus
          value={name}
          placeholder={t.exerciseNamePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field-label">{t.primaryMuscleLabel}</div>
      <div className="filter-chips">
        {MUSCLE_IDS.map((m) => (
          <Chip
            size="sm"
            selected={primary === m}
            key={m}
            onClick={() => {
              setPrimary((x) => (x === m ? null : m));
              setSecondary((xs) => xs.filter((x) => x !== m));
            }}
          >
            <MuscleIcon muscle={m} variant="chip" tone={primary === m ? 'onAccent' : 'secondary'} />
            {t.muscleGroups[m]}
          </Chip>
        ))}
      </div>

      <div className="field-label">{t.secondaryMuscleLabel}</div>
      <div className="filter-chips">
        {MUSCLE_IDS.filter((m) => m !== primary).map((m) => (
          <Chip
            size="sm"
            selected={secondary.includes(m)}
            key={m}
            onClick={() =>
              setSecondary((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m]))
            }
          >
            <MuscleIcon
              muscle={m}
              variant="chip"
              tone={secondary.includes(m) ? 'onAccent' : 'secondary'}
            />
            {t.muscleGroups[m]}
          </Chip>
        ))}
      </div>

      {(primarySplit.length > 0 || secondarySplit.length > 0) && (
        <>
          <div className="field-label">{t.subRegionsLabel}</div>
          {primarySplit.length > 0 && (
            <div className="filter-chips">
              {primarySplit.map((f) => (
                <Chip
                  size="sm"
                  selected={subPrimary.includes(f)}
                  key={f}
                  onClick={() => toggle(setSubPrimary, f)}
                >
                  {t.subMuscleNames[f]}
                </Chip>
              ))}
            </div>
          )}
          {secondarySplit.length > 0 && (
            <>
              <div className="field-label">{t.subRegionsSecondaryLabel}</div>
              <div className="filter-chips">
                {secondarySplit.map((f) => (
                  <Chip
                    size="sm"
                    selected={subSecondary.includes(f)}
                    key={f}
                    onClick={() => toggle(setSubSecondary, f)}
                  >
                    {t.subMuscleNames[f]}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="field-label">{t.equipmentLabelField}</div>
      <div className="filter-chips">
        {EQUIPMENT_IDS.map((id) => (
          <Chip
            size="sm"
            selected={equipment.includes(id)}
            key={id}
            onClick={() =>
              setEquipment((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [id]))
            }
          >
            <Icon name={equipmentIconName(id)} />
            {t.equipmentNames[id]}
          </Chip>
        ))}
      </div>

      <Button
        variant="primary"
        className="ut-lg umt-8"
        style={{ minHeight: 48 }}
        disabled={!ready}
        onClick={() => {
          const sp = subPrimary.filter((f) => primarySplit.includes(f));
          const ss = subSecondary.filter((f) => secondarySplit.includes(f));
          const subRegions: ExerciseSubRegions | undefined =
            sp.length || ss.length
              ? { primary: sp, ...(ss.length ? { secondary: ss } : {}) }
              : undefined;
          props.onSave({ id: props.init.id, name, primary, secondary, equipment, subRegions });
        }}
      >
        {props.init.id ? t.save : t.libCreateExercise}
      </Button>
    </Sheet>
  );
}
