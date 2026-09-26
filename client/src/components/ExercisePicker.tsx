/**
 * ExercisePicker — "Add exercise", v2 (design: Spotter — Exercise Picker
 * Concepts, frames A–F). One exercise per pick: tapping a card adds it, the ⓘ
 * opens its details. Home = search + day suggestions + muscle-family tiles
 * (colour = readiness); a family drills into sub-muscles and an equipment row
 * over a photo grid; typing switches to search results. Exercises already done
 * this session are marked, never blocked. On desktop the same pieces sit in one
 * modal: family rail · suggestions + grid · live preview.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Gym, Workout } from '../types';
import type { EquipmentId } from '../data/equipment';
import { EQUIPMENT_IDS } from '../data/equipment';
import { exerciseSearchText, loadExerciseInstructions, type MuscleGroup } from '../data/exercises';
import { dayReadoutLabel } from '../data/daySuggest';
import { READINESS_COLOR } from '../recovery';
import { swapCandidates } from '../swaps';
import { topHistory } from '../progression';
import { tokenMatch } from '../search';
import { canonicalExerciseName } from '../data/exercises';
import { recordWeight, useStore } from '../store';
import { fmtSet, useT } from '../i18n';
import type { Strings } from '../i18n/en';
import { ExerciseName, Icon, Sheet, Switch, useExerciseName, useIsDesktop } from '../ui';
import { FamilyFigure, equipmentIconName } from './Muscle';
import {
  FAMILIES,
  applyFilter,
  buildPickItems,
  dayReference,
  equipmentCounts,
  familyMain,
  familyOf,
  familyReadiness,
  weekSets,
  fitsDay,
  isFocusSub,
  readinessByGroup,
  sortForBrowse,
  subReadiness,
  suggest,
  type Family,
  type FamilyId,
  type PickItem,
  type Readiness,
  type SubId,
  type Suggestion,
} from '../picker';
import './ExercisePicker.css';

export interface ExercisePickerProps {
  workout: Workout;
  gym: Gym | null;
  replacing?: boolean;
  onPick: (item: PickItem) => void;
  onMarker: (kind: 'warmup' | 'cooldown') => void;
  onCardio: () => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

const PAGE = 24;

// --- small helpers ------------------------------------------------------------

function readinessColor(r: Readiness): string {
  if (r.state === 'stale' && r.days === null) return 'var(--color-neutral-600)';
  return READINESS_COLOR[r.state];
}

function readinessLabel(t: Strings, r: Readiness): string {
  if (r.state === 'recovering') return t.pickRecovering;
  if (r.state === 'nearly') return t.pickAlmost;
  if (r.days === null) return t.pickFresh;
  return r.state === 'stale' ? t.pickDueAgo(r.days) : t.pickReadyAgo(r.days);
}

function subLabel(t: Strings, s: SubId): string {
  return isFocusSub(s) ? t.subMuscleNames[s] : t.muscleGroups[s];
}

function itemMeta(t: Strings, i: PickItem): string {
  const eq = i.equipment ? t.equipmentNames[i.equipment] : null;
  if (i.doneToday) return t.pickAgain(fmtSet(i.doneToday.weight, i.doneToday.reps));
  if (!i.available && i.equipment) return t.noItemHere(t.equipmentNames[i.equipment]);
  if (i.last) return [eq, fmtSet(i.last.weight, i.last.reps)].filter(Boolean).join(' · ');
  const others = i.secondary.filter((m) => m !== 'cardio').slice(0, 1);
  return [eq, ...others.map((m) => `+ ${t.muscleGroups[m].toLowerCase()}`)]
    .filter(Boolean)
    .join(' · ');
}

function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={`xp-noimg ${className ?? ''}`} aria-hidden>
        <Icon name="barbell" />
      </span>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

function InfoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="xp-info"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name="info" />
    </button>
  );
}

function Badge({ item, t }: { item: PickItem; t: Strings }) {
  if (item.doneToday)
    return (
      <span className="xp-badge done">
        <Icon name="check" />
        {t.pickDoneBadge}
      </span>
    );
  if (item.timesDone > 0) return <span className="xp-badge mine">{t.pickYours}</span>;
  return null;
}

// --- the component --------------------------------------------------------------

export function ExercisePicker(props: ExercisePickerProps) {
  const { t } = useT();
  const exName = useExerciseName();
  const store = useStore();
  const isDesktop = useIsDesktop();
  const [now] = useState(() => Date.now());
  const hasInventory = !!props.gym?.inventory && props.gym.inventory.length > 0;

  const [q, setQ] = useState('');
  const [family, setFamily] = useState<FamilyId | null>(null);
  const [sub, setSub] = useState<SubId | null>(null);
  const [equip, setEquip] = useState<EquipmentId[]>([]);
  const [onlyGym, setOnlyGym] = useState(true);
  const [equipOpen, setEquipOpen] = useState(false);
  const [info, setInfo] = useState<PickItem | null>(null);
  /** Search screen (D): opened by typing, or the group header's search icon. */
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<PickItem | null>(null);
  // Page size resets whenever what's being browsed changes.
  const [page, setPage] = useState({ key: '', n: PAGE });
  const searchRef = useRef<HTMLInputElement>(null);

  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null && w.id !== props.workout.id),
    [store.workouts, props.workout.id],
  );
  const items = useMemo(
    () => buildPickItems(props.workout, store.workouts, props.gym),
    [props.workout, store.workouts, props.gym],
  );
  // Readiness counts TODAY's session too: 20 chest sets an hour ago means
  // chest is recovering now, not "almost ready" from last week.
  const withToday = useMemo(() => [...finished, props.workout], [finished, props.workout]);
  const readiness = useMemo(() => readinessByGroup(withToday, now), [withToday, now]);
  const famReady = useMemo(
    () => new Map(FAMILIES.map((f) => [f.id, familyReadiness(f, withToday, now)])),
    [withToday, now],
  );
  const day = useMemo(() => dayReference(props.workout, finished), [props.workout, finished]);
  const dayLabel = day.readout ? dayReadoutLabel(day.readout, t) : '';
  const todayFamilies = useMemo(
    () => new Set(FAMILIES.filter((f) => f.groups.some((g) => fitsDay(day, g))).map((f) => f.id)),
    [day],
  );
  const gymOnly = onlyGym && hasInventory;
  const eqFiltered = useMemo(
    () => applyFilter(items, { equipment: equip, onlyGym: gymOnly }),
    [items, equip, gymOnly],
  );
  const suggestions = useMemo(
    () => suggest(eqFiltered, day, finished, readiness, now, { beforeTs: props.workout.startedAt }),
    [eqFiltered, day, finished, readiness, now, props.workout.startedAt],
  );
  const suggestedKeys = useMemo(() => new Set(suggestions.map((x) => x.item.key)), [suggestions]);
  const doneToday = props.workout.exercises.filter(
    (e) => e.sets.length > 0 && (e.kind ?? 'strength') === 'strength',
  );

  // Desktop always shows a family: today's first, else chest.
  const activeFamily: FamilyId | null =
    family ?? (isDesktop ? ([...todayFamilies][0] ?? 'chest') : null);
  const fam = activeFamily ? (FAMILIES.find((f) => f.id === activeFamily) ?? null) : null;

  const groupItems = useMemo(() => {
    if (!fam) return [];
    return sortForBrowse(
      applyFilter(items, { family: fam.id, sub, onlyGym: false, equipment: [] }),
    );
  }, [items, fam, sub]);
  // Available first (sortForBrowse), what the gym can't equip stays at the end, dimmed.
  const groupShown = useMemo(
    () =>
      groupItems.filter(
        (i) => equip.length === 0 || (i.equipment !== null && equip.includes(i.equipment)),
      ),
    [groupItems, equip],
  );
  const groupEquip = useMemo(() => equipmentCounts(groupItems), [groupItems]);
  const bestInGroup = useMemo(
    () =>
      fam
        ? (suggest(eqFiltered, day, finished, readiness, now, {
            count: 1,
            family: fam.id,
            sub,
            beforeTs: props.workout.startedAt,
          })[0] ?? null)
        : null,
    [fam, sub, eqFiltered, day, finished, readiness, now, props.workout.startedAt],
  );

  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    return eqFiltered
      .concat(gymOnly ? items.filter((i) => !i.available) : [])
      .filter((i) =>
        tokenMatch(
          exerciseSearchText(
            i.name,
            [i.primary, ...i.secondary].filter((m): m is MuscleGroup => !!m),
            i.equipment,
          ),
          needle,
        ),
      )
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) ||
          Number(b.name.toLowerCase().startsWith(needle)) -
            Number(a.name.toLowerCase().startsWith(needle)) ||
          b.timesDone - a.timesDone ||
          b.quality - a.quality,
      )
      .slice(0, 60);
  }, [needle, eqFiltered, items, gymOnly]);
  const exact = items.some((i) => i.name.toLowerCase() === needle);

  const pageKey = `${activeFamily}|${sub}|${equip.join(',')}|${needle}`;
  const limit = page.key === pageKey ? page.n : PAGE;
  const setLimit = (f: (n: number) => number) => setPage({ key: pageKey, n: f(limit) });

  // Desktop keys: "/" focuses search, Enter adds the previewed exercise.
  const previewItem = preview ?? suggestions[0]?.item ?? groupShown[0] ?? null;
  useEffect(() => {
    if (!isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === searchRef.current;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (typing && q) setQ('');
        else props.onClose();
      } else if (e.key === 'Enter' && !typing && previewItem) {
        props.onPick(previewItem);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDesktop, q, previewItem, props]);

  const pick = (i: PickItem) => props.onPick(i);
  const openInfo = (i: PickItem) => (isDesktop ? setPreview(i) : setInfo(i));
  const openFamily = (f: FamilyId) => {
    setFamily(f);
    setSub(null);
    setQ('');
  };

  // --- pieces ---

  // Strength is where you are; the other three act straight away (a marker, or
  // the cardio machine list) — so they're plain buttons, not tabs.
  const kindTabs = (
    <div className="xp-kinds">
      <button type="button" className="on" aria-current="true">
        {t.exerciseKindNames.strength}
      </button>
      <button type="button" onClick={() => props.onMarker('warmup')}>
        {t.exerciseKindNames.warmup}
      </button>
      <button type="button" onClick={props.onCardio}>
        {t.exerciseKindNames.cardio}
      </button>
      <button type="button" onClick={() => props.onMarker('cooldown')}>
        {t.exerciseKindNames.cooldown}
      </button>
    </div>
  );

  const inSearch = searching || !!needle;
  const cancelSearch = () => {
    setQ('');
    setSearching(false);
  };
  const searchInput = (
    <label className="xp-search">
      <Icon name="magnifying-glass" />
      <input
        ref={searchRef}
        value={q}
        placeholder={t.pickSearch}
        aria-label={t.pickSearchShort}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setSearching(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && needle) {
            if (results[0]) pick(results[0]);
            else props.onCreate(q.trim());
          }
        }}
      />
      {q && (
        <button type="button" className="xp-clear" aria-label={t.cancel} onClick={() => setQ('')}>
          <Icon name="x" />
        </button>
      )}
    </label>
  );
  const searchBar = isDesktop ? (
    searchInput
  ) : (
    <div className="xp-searchrow">
      {searchInput}
      {inSearch && (
        <button type="button" className="xp-cancel" onClick={cancelSearch}>
          {t.cancel}
        </button>
      )}
    </div>
  );

  const equipChip = (
    <button type="button" className="xp-eqchip" onClick={() => setEquipOpen(true)}>
      <Icon name={equipmentIconName('dumbbell')} />
      {equip.length ? t.pickEquipN(equip.length) : t.pickEquipAll}
      <Icon name="caret-down" />
    </button>
  );

  const doneStrip =
    doneToday.length > 0 ? (
      <div className="xp-done">
        <Icon name="check" />
        <span>{t.pickDoneToday(doneToday.map((e) => exName(e.name)).join(' · '))}</span>
      </div>
    ) : null;

  const reasonTag = (s: Suggestion) =>
    s.reason === 'usual' ? t.pickTagUsual : s.reason === 'weak' ? t.pickTagWeak : t.pickTagFit;
  const reasonWhy = (s: Suggestion) => {
    const m = s.muscle ? t.muscleGroups[s.muscle] : '';
    return s.reason === 'usual'
      ? t.pickWhyUsual(s.item.timesDone)
      : s.reason === 'weak'
        ? t.pickWhyWeak(m)
        : t.pickWhyFit(m);
  };
  const targetLine = (s: Suggestion) => {
    const tg = s.target;
    if (tg && tg.weight !== null && s.item.last) return t.pickTry(fmtSet(tg.weight, tg.reps));
    if (s.item.last) return t.pickLast(fmtSet(s.item.last.weight, s.item.last.reps));
    return t.pickNeverDone;
  };

  const card = (i: PickItem) => (
    <div
      key={i.key}
      className={`xp-card${i.available ? '' : ' na'}${isDesktop && previewItem?.key === i.key ? ' sel' : ''}`}
      onMouseEnter={isDesktop ? () => setPreview(i) : undefined}
    >
      <button type="button" className="xp-card-main" onClick={() => pick(i)}>
        <Img src={i.image} alt="" className="xp-card-img" />
        <span className="xp-card-body">
          <ExerciseName name={i.name} className="xp-card-name" secondary={false} />
          <span className="xp-card-meta">{itemMeta(t, i)}</span>
        </span>
      </button>
      <Badge item={i} t={t} />
      <InfoButton onClick={() => openInfo(i)} label={t.detailsAction} />
    </div>
  );

  const row = (i: PickItem) => (
    <div
      key={i.key}
      className={`xp-row${i.available ? '' : ' na'}`}
      onMouseEnter={isDesktop ? () => setPreview(i) : undefined}
    >
      <button type="button" className="xp-row-main" onClick={() => pick(i)}>
        <Img src={i.image} alt="" className="xp-row-img" />
        <span className="xp-row-body">
          <ExerciseName name={i.name} className="xp-row-name" secondary={false} />
          <span className="xp-row-meta">{itemMeta(t, i)}</span>
        </span>
        {suggestedKeys.has(i.key) && !i.doneToday ? (
          <span className="xp-badge sug">{t.pickSuggestedTag}</span>
        ) : (
          <Badge item={i} t={t} />
        )}
      </button>
      <InfoButton onClick={() => openInfo(i)} label={t.detailsAction} />
    </div>
  );

  const familyTile = (f: Family) => {
    const r = famReady.get(f.id)!;
    const color = readinessColor(r);
    const today = todayFamilies.has(f.id);
    return (
      <button
        key={f.id}
        type="button"
        className={`xp-fam${today ? ' today' : ''}`}
        onClick={() => openFamily(f.id)}
      >
        {today && <span className="xp-today corner">{t.pickToday}</span>}
        <FamilyFigure groups={f.groups} color={color} view={f.view} width={38} height={72} />
        <span className="xp-fam-body">
          <span className="xp-fam-name">{t.pickFamilies[f.id]}</span>
          <span className="xp-fam-state">
            <span className="dot" style={{ background: color }} />
            {readinessLabel(t, r)}
          </span>
          <span className="xp-fam-subs">
            {f.subs.length ? f.subs.map((s) => subLabel(t, s)).join(' · ') : t.muscleGroups.core}
          </span>
        </span>
      </button>
    );
  };

  const railItem = (f: Family) => {
    const r = famReady.get(f.id)!;
    const color = readinessColor(r);
    const open = activeFamily === f.id;
    return (
      <div key={f.id} className="xp-rail-group">
        <button
          type="button"
          className={`xp-rail-fam${open ? ' open' : ''}`}
          onClick={() => openFamily(f.id)}
        >
          <FamilyFigure groups={f.groups} color={color} view={f.view} width={28} height={54} />
          <span className="xp-fam-body">
            <span className="xp-fam-name">
              {t.pickFamilies[f.id]}
              {todayFamilies.has(f.id) && <span className="xp-today">{t.pickToday}</span>}
            </span>
            <span className="xp-fam-state">
              <span className="dot" style={{ background: color }} />
              {readinessLabel(t, r)}
            </span>
          </span>
        </button>
        {open && f.subs.length > 0 && (
          <div className="xp-rail-subs">
            {[null, ...f.subs].map((s) => {
              const sr = s ? subReadiness(s, readiness) : null;
              return (
                <button
                  key={s ?? 'all'}
                  type="button"
                  className={`xp-rail-sub${sub === s ? ' on' : ''}`}
                  onClick={() => setSub(s)}
                >
                  <span
                    className="dot"
                    style={{ background: sr ? readinessColor(sr) : 'transparent' }}
                  />
                  {s ? subLabel(t, s) : t.pickAll}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const subChips = fam && fam.subs.length > 0 && (
    <div className="xp-chips">
      {[null, ...fam.subs].map((s) => {
        const sr = s ? subReadiness(s, readiness) : null;
        return (
          <button
            key={s ?? 'all'}
            type="button"
            className={`xp-chip${sub === s ? ' on' : ''}`}
            onClick={() => setSub(s)}
          >
            {sr && <span className="dot" style={{ background: readinessColor(sr) }} />}
            {s ? subLabel(t, s) : t.pickAll}
          </button>
        );
      })}
    </div>
  );

  // Equipment switcher: one choice at a time (Any, or one kind of kit). The
  // multi-select lives in the filter sheet on the start screen.
  const eqValue = equip.length === 1 ? equip[0] : equip.length === 0 ? 'any' : null;
  const equipRow = fam && groupEquip.length > 1 && (
    <div className="xp-eqrow" role="radiogroup" aria-label={t.pickEquipAll}>
      <button
        type="button"
        role="radio"
        aria-checked={eqValue === 'any'}
        className={`xp-eq${eqValue === 'any' ? ' on' : ''}`}
        onClick={() => setEquip([])}
      >
        {t.pickAny}
        <span className="n">{groupItems.length}</span>
      </button>
      {groupEquip.map(({ id, n }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={eqValue === id}
          className={`xp-eq${eqValue === id ? ' on' : ''}`}
          onClick={() => setEquip(eqValue === id ? [] : [id])}
        >
          {t.equipmentNames[id]}
          <span className="n">{n}</span>
        </button>
      ))}
    </div>
  );

  const grid = (list: PickItem[]) => (
    <>
      {list.length === 0 ? (
        <p className="xp-empty">{t.pickNothing}</p>
      ) : (
        <div className="xp-grid">{list.slice(0, limit).map(card)}</div>
      )}
      {list.length > limit && (
        <button type="button" className="xp-more" onClick={() => setLimit((n) => n + PAGE)}>
          {t.pickShowMore(Math.min(PAGE, list.length - limit))}
        </button>
      )}
    </>
  );

  // "Browse all of …": the family (and sub) most results belong to.
  const browseFamily = (() => {
    const top = results[0];
    const fid = top ? familyOf(top.primary) : null;
    return fid ? (FAMILIES.find((f) => f.id === fid) ?? null) : null;
  })();
  const browseSub: SubId | null =
    browseFamily && results[0]?.primary && browseFamily.subs.includes(results[0].primary)
      ? results[0].primary
      : null;
  const searchResults = (
    <div className="xp-results">
      {needle ? (
        <div className="xp-label">{t.pickResults(results.length)}</div>
      ) : (
        <div className="xp-label accent">
          {dayLabel ? t.pickSuggestedFor(dayLabel) : t.pickSuggestedYou}
        </div>
      )}
      {(needle ? results.slice(0, limit) : suggestions.map((x) => x.item)).map(row)}
      {results.length > limit && (
        <button type="button" className="xp-more" onClick={() => setLimit((n) => n + PAGE)}>
          {t.pickShowMore(Math.min(PAGE, results.length - limit))}
        </button>
      )}
      {browseFamily && (
        <button
          type="button"
          className="xp-browse"
          onClick={() => {
            openFamily(browseFamily.id);
            if (browseSub) setSub(browseSub);
            setSearching(false);
          }}
        >
          <span>
            {t.pickBrowseIn(
              browseSub
                ? `${t.pickFamilies[browseFamily.id]} › ${subLabel(t, browseSub)}`
                : t.pickFamilies[browseFamily.id],
            )}
          </span>
          <Icon name="caret-right" />
        </button>
      )}
      {!exact && needle && (
        <button type="button" className="xp-create" onClick={() => props.onCreate(q.trim())}>
          <Icon name="plus" />
          {t.createExercise(q.trim())}
        </button>
      )}
    </div>
  );

  // Inside a muscle group the overall next move stays in view too — the same
  // top pick the picker's home shows (unless it's this group's best anyway).
  const nextUp =
    suggestions[0] && suggestions[0].item.key !== bestInGroup?.item.key ? suggestions[0] : null;
  // "Best for <group> now" and the overall "Next up" share one wide card: kicker,
  // name, optional why-line and the target.
  const wideCard = (x: Suggestion, kicker: string, why?: string, extra = '') => (
    <div
      key={x.item.key}
      className={`xp-best${extra}`}
      onMouseEnter={isDesktop ? () => setPreview(x.item) : undefined}
    >
      <button type="button" className="xp-best-main" onClick={() => pick(x.item)}>
        <Img src={x.item.image} alt="" className="xp-best-img" />
        <span className="xp-best-body">
          <span className="xp-label accent">{kicker}</span>
          <ExerciseName name={x.item.name} className="xp-best-name" secondary={false} />
          {why && <span className="xp-sug-why">{why}</span>}
          <span className="xp-sug-target">{targetLine(x)}</span>
        </span>
      </button>
      <InfoButton onClick={() => openInfo(x.item)} label={t.detailsAction} />
    </div>
  );

  const suggestionsBlock = suggestions.length > 0 && (
    <section className="xp-sugs-wrap">
      <div className="xp-head">
        <span className="xp-label accent">
          {dayLabel ? t.pickSuggestedFor(dayLabel) : t.pickSuggestedYou}
        </span>
        <span className="xp-hint">{isDesktop ? t.pickClickHint : t.pickTapHint}</span>
      </div>
      <div className="xp-sugs-list">
        {suggestions.map((x) => wideCard(x, reasonTag(x), reasonWhy(x)))}
      </div>
    </section>
  );

  const nextUpBlock =
    nextUp &&
    wideCard(nextUp, `${t.nextUpTitle} · ${reasonTag(nextUp)}`, reasonWhy(nextUp), ' xp-nextup');

  const bestCard =
    bestInGroup &&
    wideCard(
      bestInGroup,
      t.pickBestFor((sub ? subLabel(t, sub) : t.pickFamilies[fam!.id]).toLowerCase()),
    );

  const famHeaderState = fam ? famReady.get(fam.id)! : null;

  const equipSheet = equipOpen && (
    <EquipmentFilterSheet
      t={t}
      gym={props.gym}
      selected={equip}
      onlyGym={onlyGym}
      countFor={(sel, only) =>
        applyFilter(items, { equipment: sel, onlyGym: only && hasInventory }).length
      }
      onApply={(sel, only) => {
        setEquip(sel);
        setOnlyGym(only);
        setEquipOpen(false);
      }}
      onClose={() => setEquipOpen(false)}
    />
  );

  // --- desktop ---
  if (isDesktop) {
    return createPortal(
      <div
        className="xp-modal-back"
        onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div className="xp-modal" role="dialog" aria-modal aria-label={t.addExercise}>
          <header className="xp-mhead">
            <span className="xp-title">
              <b>{props.replacing ? t.replaceExercise : t.addExercise}</b>
              {(dayLabel || doneToday.length > 0) && (
                <small>
                  {[dayLabel, doneToday.length ? t.pickNDone(doneToday.length) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              )}
            </span>
            {searchBar}
            {kindTabs}
            <button
              type="button"
              className="xp-close"
              aria-label={t.cancel}
              onClick={props.onClose}
            >
              <Icon name="x" />
            </button>
          </header>
          <div className="xp-mbody">
            <nav className="xp-rail" aria-label={t.pickMuscleGroups}>
              <div className="xp-label">{t.pickMuscleGroups}</div>
              {FAMILIES.map(railItem)}
            </nav>
            <main className="xp-main">
              {doneStrip}
              {needle ? (
                searchResults
              ) : (
                <>
                  {suggestionsBlock}
                  {fam && famHeaderState && (
                    <div className="xp-ghead">
                      <div className="xp-ghead-title">
                        <b>
                          {t.pickFamilies[fam.id]}
                          {sub && (
                            <>
                              <span className="sep">›</span>
                              {subLabel(t, sub)}
                            </>
                          )}
                        </b>
                        <span className="xp-fam-state">
                          <span
                            className="dot"
                            style={{ background: readinessColor(famHeaderState) }}
                          />
                          {readinessLabel(t, famHeaderState)}
                        </span>
                        <span className="grow" />
                        {equipChip}
                      </div>
                      {equipRow}
                    </div>
                  )}
                  {grid(groupShown)}
                </>
              )}
            </main>
            <aside className="xp-preview">
              <div className="xp-label">{t.pickPreview}</div>
              {previewItem && (
                <ExerciseDetail
                  key={previewItem.key}
                  item={previewItem}
                  items={items}
                  gym={props.gym}
                  finished={finished}
                  compact
                  onPick={pick}
                  onSwap={(i) => setPreview(i)}
                />
              )}
            </aside>
          </div>
        </div>
        {equipSheet}
      </div>,
      document.body,
    );
  }

  // --- mobile ---
  const doneN = doneToday.length;
  const headSub = [dayLabel, doneN ? t.pickNDone(doneN) : ''].filter(Boolean).join(' · ');
  const weekLine = (g: MuscleGroup) => {
    const w = weekSets(g, finished, now);
    return t.pickSetsWeek(w.done, w.target);
  };
  let body: ReactNode;
  const groupView = !inSearch && !!fam && !!famHeaderState;
  if (inSearch) {
    body = searchResults;
  } else if (fam && famHeaderState) {
    const subState = sub ? subReadiness(sub, readiness) : null;
    const st = subState ?? famHeaderState;
    const mainG: MuscleGroup = sub && !isFocusSub(sub) ? sub : familyMain(fam.id);
    body = (
      <>
        <div className="xp-ghead m">
          <button
            type="button"
            className="xp-back"
            aria-label={t.pickBackToGroups}
            onClick={() => {
              setFamily(null);
              setSub(null);
            }}
          >
            <Icon name="caret-left" />
          </button>
          <span className="xp-ghead-txt">
            <b>{t.pickFamilies[fam.id]}</b>
            <span className="xp-ghead-sub">
              <span className="st" style={{ color: readinessColor(st) }}>
                {readinessLabel(t, st)}
              </span>
              {' · '}
              {weekLine(mainG)}
            </span>
          </span>
          <button
            type="button"
            className="xp-back"
            aria-label={t.pickSearchShort}
            onClick={() => {
              setSearching(true);
              window.setTimeout(() => searchRef.current?.focus(), 0);
            }}
          >
            <Icon name="magnifying-glass" />
          </button>
        </div>
        {subChips}
        {equipRow}
        {nextUpBlock}
        {bestCard}
        <div className="xp-head gh">
          <span className="xp-label">
            {sub ? subLabel(t, sub) : t.pickFamilies[fam.id]} · {groupShown.length}
          </span>
          <span className="xp-hint">{t.pickTapHint}</span>
        </div>
        {grid(groupShown)}
      </>
    );
  } else {
    body = (
      <>
        {kindTabs}
        {doneStrip}
        {suggestionsBlock}
        <div className="xp-head fh">
          <span className="xp-label">{t.pickOrGroup}</span>
          {equipChip}
        </div>
        <div className="xp-fams">{FAMILIES.map(familyTile)}</div>
      </>
    );
  }

  return (
    <>
      <Sheet onClose={props.onClose} className="xp-sheet">
        {/* The search field keeps one stable slot in the tree, so focusing it
            (which switches to the search screen) never remounts the input. */}
        <div className="xp">
          {!inSearch && !groupView && (
            <div className="xp-title-row">
              <b>{props.replacing ? t.replaceExercise : t.addExercise}</b>
              {headSub && <span>{headSub}</span>}
            </div>
          )}
          {!groupView && searchBar}
          {body}
        </div>
      </Sheet>
      {info && (
        <Sheet onClose={() => setInfo(null)} className="xp-detail-sheet">
          <ExerciseDetail
            item={info}
            items={items}
            gym={props.gym}
            finished={finished}
            onPick={(i) => {
              setInfo(null);
              pick(i);
            }}
            onSwap={(i) => setInfo(i)}
            onBack={() => setInfo(null)}
          />
        </Sheet>
      )}
      {equipSheet}
    </>
  );
}

// --- details (mobile sheet / desktop preview) -------------------------------------

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => `${(i / (points.length - 1)) * 68 + 2},${24 - ((v - min) / span) * 20}`)
    .join(' ');
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden className="xp-spark">
      <polyline
        points={d}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExerciseDetail(props: {
  item: PickItem;
  items: PickItem[];
  gym: Gym | null;
  finished: Workout[];
  compact?: boolean;
  onPick: (i: PickItem) => void;
  onSwap: (i: PickItem) => void;
  onBack?: () => void;
}) {
  const { t } = useT();
  const { item } = props;
  const [steps, setSteps] = useState<string[]>([]);
  const [allSteps, setAllSteps] = useState(false);
  useEffect(() => {
    let live = true;
    void loadExerciseInstructions(item.catalogId).then((v) => live && setSteps(v));
    return () => {
      live = false;
    };
  }, [item.catalogId]);
  const byKey = useMemo(() => new Map(props.items.map((i) => [i.key, i])), [props.items]);
  const swaps = useMemo(
    () =>
      swapCandidates(item.name, props.gym, 4)
        .map((s) => byKey.get(canonicalExerciseName(s.name).toLowerCase()))
        .filter((x): x is PickItem => !!x && x.key !== item.key)
        .slice(0, 2),
    [item, props.gym, byKey],
  );
  const hist = useMemo(
    () => topHistory(props.finished, item.name).map((p) => p.weight ?? p.reps),
    [props.finished, item.name],
  );
  const best = item.timesDone > 0 ? recordWeight(item.name) : 0;
  const cues = allSteps ? steps : steps.slice(0, props.compact ? 1 : 2);
  const [a, b] = item.images;

  return (
    <div className={`xp-detail${props.compact ? ' compact' : ''}`}>
      {(a || b) && (
        <div className="xp-frames">
          {a && (
            <figure>
              <Img src={a} alt="" />
              <figcaption>{t.pickStart}</figcaption>
            </figure>
          )}
          {b && (
            <figure>
              <Img src={b} alt="" />
              <figcaption>{t.pickFinish}</figcaption>
            </figure>
          )}
        </div>
      )}
      <h3 className="xp-detail-name">
        <ExerciseName name={item.name} />
      </h3>
      <div className="xp-mus">
        {item.primary && <span className="pri">{t.muscleGroups[item.primary]}</span>}
        {item.secondary
          .filter((m) => m !== 'cardio' && m !== item.primary)
          .map((m) => (
            <span key={m}>{t.muscleGroups[m]}</span>
          ))}
        {item.equipment && (
          <span className="eq">
            <Icon name={equipmentIconName(item.equipment)} />
            {t.equipmentNames[item.equipment]}
          </span>
        )}
      </div>
      {item.doneToday && (
        <div className="xp-done">
          <Icon name="check" />
          <span>{t.pickAgain(fmtSet(item.doneToday.weight, item.doneToday.reps))}</span>
        </div>
      )}
      {item.timesDone > 0 && (
        <div className="xp-hist">
          <span>
            <small>{t.pickHistoryN(item.timesDone)}</small>
            {item.last && (
              <b>
                {t.pickLast(fmtSet(item.last.weight, item.last.reps))}
                {best > 0 ? ` · ${t.pickBest(`${best}`)}` : ''}
              </b>
            )}
          </span>
          <Sparkline points={hist} />
        </div>
      )}
      {swaps.length > 0 && (
        <div className="xp-dsec">
          <div className="xp-label">{t.pickSwaps}</div>
          <div className="xp-swaps">
            {swaps.map((s) => (
              <button key={s.key} type="button" onClick={() => props.onSwap(s)}>
                <Img src={s.image} alt="" />
                <span>
                  <ExerciseName name={s.name} className="n" secondary={false} />
                  <small>{s.equipment ? t.equipmentNames[s.equipment] : ''}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {steps.length > 0 && (
        <div className="xp-dsec">
          <div className="xp-label">{t.pickKeyCues}</div>
          <ol className="xp-cues">
            {cues.map((s, i) => (
              <li key={i}>
                <span className="n">{i + 1} ·</span>
                {s}
              </li>
            ))}
          </ol>
          {steps.length > cues.length || allSteps ? (
            <button type="button" className="xp-link" onClick={() => setAllSteps((x) => !x)}>
              {allSteps ? t.pickFewerSteps : t.pickAllSteps(steps.length)}
            </button>
          ) : null}
        </div>
      )}
      <div className="xp-detail-actions">
        {props.onBack && (
          <button type="button" className="btn btn-secondary" onClick={props.onBack}>
            {t.backAction}
          </button>
        )}
        <button type="button" className="btn btn-primary xp-add" onClick={() => props.onPick(item)}>
          {t.pickAddToSession}
          {props.compact && <kbd>↵</kbd>}
        </button>
      </div>
    </div>
  );
}

// --- equipment filter ----------------------------------------------------------

function EquipmentFilterSheet(props: {
  t: Strings;
  gym: Gym | null;
  selected: EquipmentId[];
  onlyGym: boolean;
  countFor: (sel: EquipmentId[], onlyGym: boolean) => number;
  onApply: (sel: EquipmentId[], onlyGym: boolean) => void;
  onClose: () => void;
}) {
  const { t } = props;
  const [sel, setSel] = useState<EquipmentId[]>(props.selected);
  const [only, setOnly] = useState(props.onlyGym);
  const inv = props.gym?.inventory ?? [];
  const n = props.countFor(sel, only);
  return (
    <Sheet onClose={props.onClose} className="xp-equip-sheet">
      <div className="xp-equip">
        <h3>{t.pickEquipTitle}</h3>
        <p>{t.pickEquipSub}</p>
        <div className="xp-equip-grid">
          {EQUIPMENT_IDS.map((id) => {
            const on = sel.includes(id);
            const missing = inv.length > 0 && !inv.includes(id) && id !== 'body';
            return (
              <button
                key={id}
                type="button"
                className={`xp-equip-tile${on ? ' on' : ''}${missing ? ' na' : ''}`}
                aria-pressed={on}
                onClick={() => setSel((cur) => (on ? cur.filter((x) => x !== id) : [...cur, id]))}
              >
                {on && (
                  <span className="tick">
                    <Icon name="check" />
                  </span>
                )}
                <Icon name={equipmentIconName(id)} />
                <b>{t.equipmentNames[id]}</b>
                {inv.length > 0 && (
                  <small>
                    {id === 'body' ? t.pickAlways : missing ? t.pickNotInGym : t.pickInGym}
                  </small>
                )}
              </button>
            );
          })}
        </div>
        {inv.length > 0 && (
          <button type="button" className="toggle-row xp-only" onClick={() => setOnly((x) => !x)}>
            <span>
              <b>{t.pickOnlyGym}</b>
              <small>{t.pickOnlyGymSub}</small>
            </span>
            <Switch on={only} />
          </button>
        )}
        <div className="xp-detail-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setSel([])}>
            {t.pickReset}
          </button>
          <button
            type="button"
            className="btn btn-primary xp-add"
            onClick={() => props.onApply(sel, only)}
          >
            {t.pickShowN(n)}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
