/**
 * Exercise gallery (design LIB-1 phone list, LIB-2 web poster grid).
 *
 * One implementation, two entry points (AC-LIBTAB-03): the standalone library
 * overlay and the Programs "Exercises" tab both render this. Every row previews
 * its media — a video thumbnail with poster, play glyph and clip length when a
 * clip exists, an image glyph labelled "stills only" when only stills exist,
 * the house graphic otherwise; never a play button over a clip-less exercise
 * (AC-LIB-02). It reuses the muscle + equipment filter and adds one filter,
 * "Has video" (AC-LIB-01). A row opens the exercise detail (AC-DET-06).
 */
import { useMemo, useRef, useState } from 'react';
import { CURATED, muscleInfoByName, secondaryMusclesOf, type MuscleGroup } from '../data/exercises';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { clipLen, exerciseMedia, type MediaKind } from '../data/exerciseMedia';
import { knownExercises, useStore } from '../store';
import { useT } from '../i18n';
import { Icon, useIsDesktop } from '../ui';
import { equipmentLabel, MUSCLE_IDS } from '../components/Muscle';
import { HouseGraphic } from './HouseGraphic';
import type { Shell } from '../App';

interface Row {
  key: string;
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
  kind: MediaKind;
  lenSec: number;
}

/** Persisted filter state so the tab keeps it across switches (AC-LIBTAB-04). */
export interface GalleryState {
  q: string;
  muscle?: MuscleGroup;
  equip?: EquipmentId;
  hasVideo: boolean;
  scope: 'here' | 'all';
}
const DEFAULT_STATE: GalleryState = { q: '', hasVideo: false, scope: 'all' };

export function ExerciseGallery({
  shell,
  state,
  onState,
}: {
  shell: Shell;
  state?: GalleryState;
  onState?: (s: GalleryState) => void;
}) {
  const { t } = useT();
  const store = useStore();
  const isDesktop = useIsDesktop();
  const [local, setLocal] = useState<GalleryState>(state ?? DEFAULT_STATE);
  const s = state ?? local;
  const set = (patch: Partial<GalleryState>) => {
    const next = { ...s, ...patch };
    if (onState) onState(next);
    else setLocal(next);
  };
  const searchRef = useRef<HTMLInputElement>(null);

  const homeGym = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of store.workouts)
      if (w.gymId) counts.set(w.gymId, (counts.get(w.gymId) ?? 0) + 1);
    return (
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => store.gyms.find((g) => g.id === id))
        .find((g) => !!g?.inventory && g.inventory.length > 0) ?? null
    );
  }, [store.workouts, store.gyms]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const c of CURATED) {
      const m = exerciseMedia(c.id);
      out.push({
        key: c.id,
        name: c.names[0],
        primary: c.muscle === 'cardio' ? null : c.muscle,
        secondary: secondaryMusclesOf(c),
        equipment: c.equipment ?? null,
        kind: m.kind,
        lenSec: m.clip?.lenSec ?? 0,
      });
      for (const n of c.names) seen.add(n.toLowerCase());
    }
    for (const k of knownExercises()) {
      if (seen.has(k.name.toLowerCase())) continue;
      const info = muscleInfoByName(k.name);
      const m = exerciseMedia(k.name);
      out.push({
        key: `hist-${k.name}`,
        name: k.name,
        primary: info && info.primary !== 'cardio' ? info.primary : null,
        secondary: info?.secondary ?? [],
        equipment: (info?.equipment as EquipmentId | null) ?? null,
        kind: m.kind,
        lenSec: m.clip?.lenSec ?? 0,
      });
    }
    return out;
  }, []);

  const needle = s.q.trim().toLowerCase();
  const matches = rows
    .filter(
      (r) =>
        (!needle || r.name.toLowerCase().includes(needle)) &&
        (s.muscle === undefined || r.primary === s.muscle || r.secondary.includes(s.muscle)) &&
        (s.equip === undefined || r.equipment === s.equip) &&
        (!s.hasVideo || r.kind === 'clip'),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const withVideo = rows.filter((r) => r.kind === 'clip').length;
  const unavailable = (r: Row): boolean =>
    s.scope === 'here' &&
    !!homeGym?.inventory &&
    !!r.equipment &&
    !homeGym.inventory.includes(r.equipment);

  const musclesText = (r: Row) =>
    [r.primary, ...r.secondary].filter(Boolean).map((m) => t.muscleGroups[m as MuscleGroup]);

  const open = (r: Row) => shell.openOverlay({ screen: 'exercise-detail', name: r.name });

  const shown = matches.slice(0, isDesktop ? 60 : 40);

  // --- media thumb (shared) -------------------------------------------------
  const thumb = (r: Row, i: number, big: boolean) => {
    const frame = i % 2 === 1 ? 'var(--frame2)' : 'var(--frame)';
    if (r.kind === 'clip') {
      return (
        <div className="exg-thumb" style={{ background: frame }}>
          <Icon name="play-circle" weight="fill" className="exg-play" />
          {r.lenSec > 0 && <span className="exg-len">{clipLen(r.lenSec)}</span>}
        </div>
      );
    }
    if (r.kind === 'stills') {
      return (
        <div className="exg-thumb stills">
          <Icon name="image-square" className="exg-imgglyph" />
        </div>
      );
    }
    return (
      <div className="exg-thumb none">
        <HouseGraphic size={big ? 120 : 60} />
      </div>
    );
  };

  // --- filter bar (search + muscle vocab + Has video + scope) ---------------
  const filterBar = (
    <div className="exg-filters">
      <label className="exg-search">
        <Icon name="magnifying-glass" />
        <input
          ref={searchRef}
          value={s.q}
          placeholder={t.searchExercises}
          onChange={(e) => set({ q: e.target.value })}
        />
      </label>
      <button
        className={`exg-seg-chip${s.hasVideo ? ' active' : ''}`}
        onClick={() => set({ hasVideo: !s.hasVideo })}
      >
        {t.hasVideoFilter}
      </button>
      {homeGym && (
        <div className="seg3 exg-scope">
          <button
            className={s.scope === 'here' ? 'active' : ''}
            onClick={() => set({ scope: 'here' })}
          >
            {t.availableHere}
          </button>
          <button
            className={s.scope === 'all' ? 'active' : ''}
            onClick={() => set({ scope: 'all' })}
          >
            {t.allGyms}
          </button>
        </div>
      )}
    </div>
  );

  const vocab = (
    <div className="exg-vocab">
      {MUSCLE_IDS.map((m) => (
        <button
          key={m}
          className={`vchip${s.muscle === m ? ' active' : ''}`}
          onClick={() => set({ muscle: s.muscle === m ? undefined : m })}
        >
          {t.muscleGroups[m]}
        </button>
      ))}
      {isDesktop &&
        EQUIPMENT_IDS.slice(0, 6).map((id) => (
          <button
            key={id}
            className={`vchip${s.equip === id ? ' active' : ''}`}
            onClick={() => set({ equip: s.equip === id ? undefined : id })}
          >
            {equipmentLabel(id)}
          </button>
        ))}
    </div>
  );

  return (
    <div className={`exg${isDesktop ? ' desktop' : ''}`}>
      <div className="exg-sub">{t.inLibraryVideos(rows.length, withVideo)}</div>
      {filterBar}
      {vocab}
      {isDesktop ? (
        <div className="exg-grid">
          {shown.map((r, i) => (
            <button
              key={r.key}
              className={`exg-card${unavailable(r) ? ' off' : ''}`}
              onClick={() => open(r)}
            >
              {thumb(r, i, true)}
              <div className="exg-card-body">
                <div className="exg-name">{r.name}</div>
                <div className="exg-muscles">
                  {musclesText(r).join(' · ')}
                  {r.kind === 'stills' && ` · ${t.stillsOnly}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="exg-list">
          {shown.map((r, i) => (
            <button
              key={r.key}
              className={`exg-row${unavailable(r) ? ' off' : ''}`}
              onClick={() => open(r)}
            >
              {thumb(r, i, false)}
              <div className="exg-row-body">
                <div className="exg-name">{r.name}</div>
                <div className="exg-muscles">{musclesText(r).join(' · ')}</div>
                <div className="exg-equip">
                  {r.equipment ? equipmentLabel(r.equipment) : '—'}
                  {r.kind === 'stills' && (
                    <>
                      {' · '}
                      <span className="exg-stills-tag">{t.stillsOnly}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
