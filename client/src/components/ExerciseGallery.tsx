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
import { useMemo, useRef, useState } from 'react';
import {
  BUILT_IN_CATALOG,
  muscleInfoByName,
  richExerciseByName,
  secondaryMusclesOf,
  type ExerciseCategory,
  type ExerciseForce,
  type ExerciseLevel,
  type ExerciseMechanic,
  type MuscleGroup,
} from '../data/exercises';
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
import { useT } from '../i18n';
import { ConfirmDialog, Icon, Sheet, useIsDesktop } from '../ui';
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

const ELLIPSIS = -1;
/**
 * Page numbers to show (0-based), with ELLIPSIS gaps — always first + last,
 * the current page and its neighbours, capped so the control never grows past
 * ~7 slots however many pages exist (numbered-pagination best practice).
 */
function pageWindow(cur: number, last: number): number[] {
  const total = last + 1;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: number[] = [0];
  const start = Math.max(1, cur - 1);
  const end = Math.min(last - 1, cur + 1);
  if (start > 1) out.push(ELLIPSIS);
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < last - 1) out.push(ELLIPSIS);
  out.push(last);
  return out;
}

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
  const searchRef = useRef<HTMLInputElement>(null);
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
      if (seen.has(k.name.toLowerCase())) continue;
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
            (!needle || r.name.toLowerCase().includes(needle)) &&
            (s.muscle === undefined || r.primary === s.muscle || r.secondary.includes(s.muscle)) &&
            (s.equip === undefined || r.equipment === s.equip) &&
            (s.category === undefined || r.category === s.category) &&
            (s.mechanic === undefined || r.mechanic === s.mechanic) &&
            (s.force === undefined || r.force === s.force) &&
            (s.level === undefined || r.level === s.level),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
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
        (!needle || r.name.toLowerCase().includes(needle)) &&
        (s.muscle === undefined || r.primary === s.muscle || r.secondary.includes(s.muscle)) &&
        (s.equip === undefined || r.equipment === s.equip),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const list = isMine ? mineMatches : matches;
  const PAGE = isDesktop ? 24 : 12;
  const maxPage = Math.max(0, Math.ceil(list.length / PAGE) - 1);
  const curPage = Math.min(page, maxPage);
  const shown = list.slice(curPage * PAGE, curPage * PAGE + PAGE);

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
          <button key={a.key} className="badge b-mus-pri" onClick={a.clear}>
            {a.label}
            <Icon name="x" />
          </button>
        ))}
      </div>
    ) : null;

  // --- filter groups (shared: desktop rail + mobile sheet) ------------------
  const chip = (
    isActive: boolean,
    label: string,
    onClick: () => void,
    key: string,
    base = 'b-mus',
  ) => (
    <button key={key} className={`badge ${base}${isActive ? ' is-active' : ''}`} onClick={onClick}>
      {label}
    </button>
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
              'b-eq',
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

  const pager =
    maxPage > 0 ? (
      <nav className="exl-pager" aria-label={t.pagination}>
        <button
          className="exl-pagebtn"
          disabled={curPage === 0}
          onClick={() => setPage(curPage - 1)}
          aria-label={t.pagePrev}
        >
          <Icon name="caret-left" />
        </button>
        {pageWindow(curPage, maxPage).map((p, i) =>
          p === ELLIPSIS ? (
            <span key={`gap-${i}`} className="exl-pagegap">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`exl-pagenum${p === curPage ? ' active' : ''}`}
              aria-current={p === curPage ? 'page' : undefined}
              onClick={() => setPage(p)}
            >
              {p + 1}
            </button>
          ),
        )}
        <button
          className="exl-pagebtn"
          disabled={curPage >= maxPage}
          onClick={() => setPage(curPage + 1)}
          aria-label={t.pageNext}
        >
          <Icon name="caret-left" className="flip" />
        </button>
      </nav>
    ) : null;

  const card = (r: Row, i: number) => (
    <button key={r.key} className="exl-card" onClick={() => open(r)}>
      {media(r, i, 'exl-media')}
      <div className="exl-cardbody">
        <div className="exl-cardname">
          <span>{r.name}</span>
        </div>
        <div className="exl-cardmus">{musclesText(r)}</div>
        {/* Always rendered, even when empty: it reserves its own row so a card
            without badges is exactly as tall as one with them. */}
        <div className="exl-cardbadges">
          {r.mechanic && <span className="badge b-mech sm">{t.mechanicNames[r.mechanic]}</span>}
          {r.equipment && (
            <span className="badge b-eq sm">
              <Icon name={equipmentIconName(r.equipment)} />
              {t.equipmentNames[r.equipment]}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  const listRow = (r: Row, i: number) => (
    <button key={r.key} className="exl-mrow" onClick={() => open(r)}>
      {media(r, i, 'exl-mthumb')}
      <div className="exl-mbody">
        <div className="exl-mname">
          <span>{r.name}</span>
        </div>
        <div className="exl-mmus">{musclesText(r)}</div>
        <div className="exl-mbadges">
          {r.mechanic && <span className="badge b-mech sm">{t.mechanicNames[r.mechanic]}</span>}
          {r.force && <span className="badge b-mus sm">{t.forceNames[r.force]}</span>}
          {r.equipment && (
            <span className="badge b-eq sm">
              <Icon name={equipmentIconName(r.equipment)} />
              {t.equipmentNames[r.equipment]}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  // One "New exercise" button, same design + behaviour everywhere. Uses the
  // primary (brass-outlined) style so it reads identically to "New program".
  const newBtn = canEdit ? (
    <button className="btn btn-primary exl-new" onClick={openCreate}>
      <Icon name="plus" />
      {t.libCreateExercise}
    </button>
  ) : null;

  const mineRow = (r: Row) => {
    const e = r.mineRef;
    return (
      <div key={r.key} className="exl-mrow exg-mine-row">
        <button className="exg-mine-open" onClick={() => open(r)}>
          <div className="exl-mbody">
            <div className="exl-mname">{r.name}</div>
            <div className="exl-mmus">{musclesText(r) || t.libNoClassInline}</div>
            {r.equipment && (
              <div className="exl-mbadges">
                <span className="badge b-eq sm">
                  <Icon name={equipmentIconName(r.equipment)} />
                  {t.equipmentNames[r.equipment]}
                </span>
              </div>
            )}
          </div>
        </button>
        {canEdit && e && (
          <div className="exg-mine-acts">
            <button
              className="exg-mine-act"
              aria-label={t.openHistory}
              title={t.openHistory}
              onClick={() => shell.openOverlay({ screen: 'exercise-history', name: r.name })}
            >
              <Icon name="clock-counter-clockwise" />
            </button>
            <button
              className="exg-mine-act"
              aria-label={t.edit}
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
            >
              <Icon name="pencil-simple" />
            </button>
            {e.source === 'catalog' && (
              <button
                className="exg-mine-act danger"
                aria-label={t.bmRemove}
                title={t.bmRemove}
                onClick={() => setDeleting(e)}
              >
                <Icon name="trash" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const body =
    isMine && mine.length === 0 ? (
      <div className="exg-mine-empty">{t.libNoCustom}</div>
    ) : isMine ? (
      <div className="exl-mrows">{shown.map(mineRow)}</div>
    ) : isDesktop ? (
      <div className="exl-grid">{shown.map(card)}</div>
    ) : (
      <div className="exl-mrows">{shown.map(listRow)}</div>
    );

  // Library / My-exercises subtabs. They live under the content heading (not in
  // the rail), mirroring how Programs stacks its title and switcher.
  const subTabs = (
    <div className="exg-tabs" role="tablist">
      <button
        role="tab"
        aria-selected={tab === 'library'}
        className={tab === 'library' ? 'active' : ''}
        onClick={() => setTab('library')}
      >
        {t.libTabLibrary}
      </button>
      <button
        role="tab"
        aria-selected={tab === 'mine'}
        className={tab === 'mine' ? 'active' : ''}
        onClick={() => setTab('mine')}
      >
        {t.libTabMine}
        {mine.length > 0 && <span className="exg-tabcount">{mine.length}</span>}
      </button>
    </div>
  );

  const searchField = (
    <label className="exl-search">
      <Icon name="magnifying-glass" />
      <input
        ref={searchRef}
        value={s.q}
        placeholder={t.searchExercises}
        onChange={(e) => set({ q: e.target.value })}
      />
    </label>
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
            <button
              className={`exl-funnel${active.length > 0 ? ' on' : ''}`}
              onClick={() => setShowFilters(true)}
              aria-label={t.libFiltersLabel}
            >
              <Icon name="funnel-simple" />
            </button>
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
            <button
              className="sheet-back"
              onClick={() => setShowFilters(false)}
              aria-label={t.backAction}
            >
              <Icon name="caret-left" />
            </button>
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

interface CustomEditState {
  id: string | null;
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string[];
}

/** Create / edit a custom exercise: name + primary + secondary + equipment.
 *  Save is the confirmation step (an edit only lands when Save is pressed). */
function CustomEditor(props: {
  init: CustomEditState;
  onClose: () => void;
  onSave: (v: CustomEditState) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(props.init.name);
  const [primary, setPrimary] = useState<MuscleGroup | null>(props.init.primary);
  const [secondary, setSecondary] = useState<MuscleGroup[]>(props.init.secondary);
  const [equipment, setEquipment] = useState<string[]>(props.init.equipment);
  const ready = name.trim().length > 0;

  return (
    <Sheet onClose={props.onClose} className="new-exercise-sheet">
      <div className="sheet-head with-back">
        <button className="sheet-back" onClick={props.onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="t">{props.init.id ? t.libEditExercise : t.libCreateExercise}</span>
      </div>

      <label className="bm-field">
        <span className="bm-field-label">{t.exerciseNameLabel}</span>
        <input
          className="input"
          autoFocus
          value={name}
          placeholder={t.exerciseNamePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field-label">{t.primaryMuscleLabel}</div>
      <div className="filter-chips">
        {MUSCLE_IDS.map((m) => (
          <button
            key={m}
            className={`fchip${primary === m ? ' active' : ''}`}
            onClick={() => {
              setPrimary((x) => (x === m ? null : m));
              setSecondary((xs) => xs.filter((x) => x !== m));
            }}
          >
            <MuscleIcon muscle={m} variant="chip" tone={primary === m ? 'onAccent' : 'secondary'} />
            {t.muscleGroups[m]}
          </button>
        ))}
      </div>

      <div className="field-label">{t.secondaryMuscleLabel}</div>
      <div className="filter-chips">
        {MUSCLE_IDS.filter((m) => m !== primary).map((m) => (
          <button
            key={m}
            className={`fchip${secondary.includes(m) ? ' active' : ''}`}
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
          </button>
        ))}
      </div>

      <div className="field-label">{t.equipmentLabelField}</div>
      <div className="filter-chips">
        {EQUIPMENT_IDS.map((id) => (
          <button
            key={id}
            className={`fchip${equipment.includes(id) ? ' active' : ''}`}
            onClick={() =>
              setEquipment((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [id]))
            }
          >
            <Icon name={equipmentIconName(id)} />
            {t.equipmentNames[id]}
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        style={{ minHeight: 48, fontSize: 15, marginTop: 'var(--space-3)' }}
        disabled={!ready}
        onClick={() => props.onSave({ id: props.init.id, name, primary, secondary, equipment })}
      >
        {props.init.id ? t.save : t.libCreateExercise}
      </button>
    </Sheet>
  );
}
