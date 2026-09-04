/**
 * Exercise detail (design RICH / SPARSE; MEDIA-1…5).
 *
 * The page reads the full record and degrades gracefully. A base lift (RICH)
 * shows classification badges (category/mechanic/force/level/equipment), the
 * muscle silhouette with primary in brass and secondary in grey, the public-
 * domain form photos (landscape), numbered instructions and the derived
 * history block. Custom/history-only lifts still render gracefully from logged
 * metadata. The media header degrades form photo → barbell glyph. "Add to
 * today's session" makes the page a route into logging, not a dead end
 * (AC-DET-06).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  canonicalExerciseName,
  customExercises,
  loadExerciseInstructions,
  muscleInfoByName,
  richExerciseByName,
  subRegionsByName,
  type MuscleGroup,
} from '../data/exercises';
import {
  equipmentIconName,
  equipmentLabel,
  MuscleBodyFigure,
  MuscleSetChip,
} from '../components/Muscle';
import { CustomEditor } from '../components/ExerciseGallery';
import { swapCandidates } from '../swaps';
import { activeGym } from '../fixit';
import {
  addExercise,
  estimatedOneRepMaxSet,
  est1rm,
  recordWeight,
  startWorkout,
  topSet,
  updateCatalogExercise,
  useStore,
} from '../store';
import { useT } from '../i18n';
import { getRole } from '../api';
import { Icon, useIsDesktop } from '../ui';
import type { Shell } from '../App';

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = 'none';
};

type DetailPhoto = { src: string; label: string };

export function ExerciseDetailView({
  name,
  shell,
  onClose,
}: {
  name: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const isDesktop = useIsDesktop();
  const [photo, setPhoto] = useState<DetailPhoto | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);

  const canonical = canonicalExerciseName(name);
  const info = muscleInfoByName(canonical);
  const rich = richExerciseByName(canonical);
  const subR = subRegionsByName(canonical);
  const hasBaseRecord = !!rich;

  // Instructions are lazy-loaded (kept out of the main bundle); fetch per lift.
  const [instructionSteps, setInstructionSteps] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    // loadExerciseInstructions(undefined) resolves to [], so no id is handled
    // here too — without a synchronous setState in the effect body.
    void loadExerciseInstructions(rich?.id).then((steps) => {
      if (live) setInstructionSteps(steps);
    });
    return () => {
      live = false;
    };
  }, [rich?.id]);

  // Custom ("My exercises") entry, if any — editable in place. Recomputed each
  // render so an edit (which emits) refreshes it; not memoised on a stale key.
  const custom =
    customExercises().find((e) => e.name.trim().toLowerCase() === canonical.trim().toLowerCase()) ??
    null;
  const [editing, setEditing] = useState(false);

  const equipment = info?.equipment ?? rich?.equipment ?? null;
  const category = rich?.category ?? null;
  const mechanic = rich?.mechanic ?? null;
  const force = rich?.force ?? null;
  const level = rich?.level ?? null;

  const infoPrimary: MuscleGroup | null = info && info.primary !== 'cardio' ? info.primary : null;
  const primaries: MuscleGroup[] = (
    rich?.primaryMuscles?.length ? rich.primaryMuscles : infoPrimary ? [infoPrimary] : []
  ).filter((m) => m !== 'cardio');
  const secondaries: MuscleGroup[] = (
    rich?.secondaryMuscles?.length ? rich.secondaryMuscles : (info?.secondary ?? [])
  ).filter((m) => m !== 'cardio');

  // History (derived from logs — independent of the base record).
  const sessions = store.workouts
    .filter((w) => w.finishedAt !== null)
    .map((w) => {
      const ex = w.exercises.find(
        (e) => e.name.trim().toLowerCase() === canonical.trim().toLowerCase(),
      );
      const top = ex && (estimatedOneRepMaxSet(ex.sets) ?? topSet(ex.sets));
      return ex && top ? { ts: w.startedAt, top } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const record = recordWeight(canonical);
  const lastTop = sessions[0]?.top.weight ?? 0;
  const est = sessions.reduce((max, s) => Math.max(max, est1rm(s.top.weight ?? 0, s.top.reps)), 0);

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
  const available = !!equipment && !!homeGym?.inventory && homeGym.inventory.includes(equipment);

  useEffect(() => {
    if (!photo) return undefined;
    const prev = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhoto(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [photo]);

  function addToSession() {
    const open = store.workouts.find((w) => w.finishedAt === null);
    const w = open ?? startWorkout(null);
    addExercise(w.id, canonical, 'strength');
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }

  function openPhoto(next: DetailPhoto) {
    setPhoto(next);
    setPhotoZoom(1);
  }

  // --- classification badges ------------------------------------------------
  const badgesRow = (
    <div className="exd-badges">
      {category && <span className="badge b-cat">{t.categoryNames[category]}</span>}
      {mechanic && <span className="badge b-mech">{t.mechanicNames[mechanic]}</span>}
      {force && <span className="badge b-mech">{t.forceNames[force]}</span>}
      {level && <span className="badge b-mech">{t.levelNames[level]}</span>}
      {equipment && (
        <span className="badge b-eq">
          <Icon name={equipmentIconName(equipment)} />
          {t.equipmentNames[equipment]}
        </span>
      )}
    </div>
  );

  const musclesSection = (primaries.length > 0 || secondaries.length > 0) && (
    <div className="exd-section">
      <h6 className="exd-label">{t.musclesWorkedLabel}</h6>
      <div className="exd-muscles-row">
        <MuscleBodyFigure
          primary={primaries}
          secondary={secondaries}
          width={isDesktop ? 148 : 128}
        />
        <div className="exd-mcols">
          {primaries.length > 0 && (
            <div className="exd-mrow-badges">
              {primaries.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="badge b-mus-pri"
                  onClick={() => shell.openOverlay({ screen: 'muscle-history', muscle: m })}
                >
                  {t.muscleGroups[m]}
                </button>
              ))}
            </div>
          )}
          {subR && (subR.primary.length > 0 || (subR.secondary?.length ?? 0) > 0) && (
            <div className="exd-subregions">
              {subR.primary.map((f) => (
                <span key={f} className="exd-subchip">
                  {t.subMuscleNames[f]}
                </span>
              ))}
              {(subR.secondary ?? []).map((f) => (
                <span key={f} className="exd-subchip minor">
                  {t.subMuscleNames[f]}
                </span>
              ))}
            </div>
          )}
          {secondaries.length > 0 && (
            <div className="exd-mrow-badges">
              {secondaries.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="badge b-mus"
                  onClick={() => shell.openOverlay({ screen: 'muscle-history', muscle: m })}
                >
                  {t.muscleGroups[m]}
                </button>
              ))}
            </div>
          )}
          <div className="exd-mlegend">{t.musclesLegend}</div>
        </div>
      </div>
    </div>
  );

  const instructions = instructionSteps.length > 0 && (
    <div className="exd-section">
      <h6 className="exd-label">{t.instructionsLabel}</h6>
      <div className="exd-instr-list">
        {instructionSteps.map((step, i) => (
          <div className="exd-instr" key={i}>
            <span className="exd-instr-n">{i + 1}</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const formPhotos = rich && rich.images.length > 0 && (
    <div className="exd-section">
      <h6 className="exd-label">{t.formPhotosLabel}</h6>
      <div className={`exd-formphotos${rich.images.length === 1 ? ' single' : ''}`}>
        {rich.images.slice(0, 2).map((src, i) => (
          <button
            className="exd-formphoto"
            key={src}
            onClick={() => openPhoto({ src, label: i === 0 ? t.photoStart : t.photoEnd })}
            aria-label={`${t.openAction}: ${i === 0 ? t.photoStart : t.photoEnd}`}
          >
            <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} onError={hideBroken} />
            <span className="exd-photo-label">{i === 0 ? t.photoStart : t.photoEnd}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const historySection = (
    <div className="exd-section">
      <h6 className="exd-label">{t.detailFromHistory}</h6>
      <div className={`exd-tiles ${hasBaseRecord ? 'n4' : 'n2'}`}>
        <div className="exd-tile">
          <div className="exd-tile-num ok">{record > 0 ? record : '—'}</div>
          <div className="exd-tile-label">{t.recordKg}</div>
        </div>
        {hasBaseRecord && (
          <div className="exd-tile">
            <div className="exd-tile-num">{est > 0 ? est : '—'}</div>
            <div className="exd-tile-label">{t.est1rmLabel}</div>
          </div>
        )}
        <div className="exd-tile">
          <div className="exd-tile-num">{sessions.length}</div>
          <div className="exd-tile-label">{t.detailSessions}</div>
        </div>
        {hasBaseRecord && (
          <div className="exd-tile">
            <div className="exd-tile-num">{lastTop > 0 ? lastTop : '—'}</div>
            <div className="exd-tile-label">{t.lastTop}</div>
          </div>
        )}
      </div>
      {available && equipment && (
        <div className="exd-avail">
          <Icon name="check-circle" weight="bold" />
          {t.availableAtGymLine(equipmentLabel(equipment))}
        </div>
      )}
    </div>
  );

  // --- Smart swaps (design SWAP-1): same-profile alternatives, gym-aware ----
  const swapGym = activeGym(
    store.gyms,
    store.workouts.filter((w) => w.finishedAt !== null),
  );
  const swaps = info && info.primary !== 'cardio' ? swapCandidates(canonical, swapGym, 4) : [];
  const alternativesSection = swaps.length > 0 && (
    <div className="exd-section">
      <h6 className="exd-label">{t.swapAlternatives}</h6>
      <div className="swap-list">
        {swaps.map((s) => {
          const pct = Math.round(s.match * 100);
          const avail = s.bodyweight
            ? { cls: 'any', icon: 'person-simple', text: t.fixAnywhere }
            : !swapGym
              ? {
                  cls: 'neutral',
                  icon: 'barbell',
                  text: s.equipment.map((e) => equipmentLabel(e)).join(' · ') || t.fixAnywhere,
                }
              : s.available
                ? { cls: 'ok', icon: 'check-circle', text: t.fixAtGym(swapGym.name) }
                : {
                    cls: 'warn',
                    icon: 'warning-circle',
                    text: t.fixMissing(s.missing.map((e) => equipmentLabel(e)).join(' · ')),
                  };
          return (
            <button
              key={s.name}
              className="swap-row"
              onClick={() => shell.openOverlay({ screen: 'exercise-detail', name: s.name })}
            >
              <div className="swap-head">
                <span className="swap-name">{s.name}</span>
                <span className="swap-match">{t.swapMatch(pct)}</span>
              </div>
              <div className="swap-bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              {s.primary && (
                <div className="swap-meta">
                  <MuscleSetChip muscle={s.primary} tone="primary" />
                  {s.secondary.slice(0, 2).map((m) => (
                    <MuscleSetChip key={m} muscle={m} tone="secondary" />
                  ))}
                </div>
              )}
              <div className={`swap-avail ${avail.cls}`}>
                <Icon name={avail.icon} />
                <span>{avail.text}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // --- media header: form photo → barbell glyph ----------------------------
  const renderMedia = (ratio: '16-9' | 'phone') => {
    if (rich?.images[0]) {
      return (
        <button
          className={`exd-media photo ${ratio}`}
          onClick={() => openPhoto({ src: rich.images[0], label: canonical })}
          aria-label={`${t.openAction}: ${canonical}`}
        >
          <img src={rich.images[0]} alt="" onError={hideBroken} />
        </button>
      );
    }
    return (
      <div className={`exd-media none ${ratio}`}>
        <div className="exd-house">
          <Icon name="barbell" />
        </div>
      </div>
    );
  };

  const titleRow = (lg: boolean) => (
    <div>
      <div className="exd-title-row">
        <h2 className={`exd-title${lg ? ' lg' : ''}`}>{canonical}</h2>
      </div>
      {badgesRow}
    </div>
  );

  const lightbox = photo && (
    <div className="exd-lightbox" role="dialog" aria-modal="true">
      <button className="exd-lightbox-scrim" onClick={() => setPhoto(null)} aria-label={t.cancel} />
      <div className="exd-lightbox-top">
        <div className="exd-lightbox-title">{photo.label}</div>
        <button className="exd-lightbox-close" onClick={() => setPhoto(null)} aria-label={t.cancel}>
          <Icon name="x" />
        </button>
      </div>
      <div className="exd-lightbox-stage">
        <img
          src={photo.src}
          alt=""
          draggable={false}
          onDoubleClick={() => setPhotoZoom((z) => (z > 1 ? 1 : 2.5))}
          style={{
            width: photoZoom > 1 ? `${Math.round(photoZoom * 100)}vw` : undefined,
            maxWidth: photoZoom === 1 ? 'calc(100vw - 32px)' : 'none',
            maxHeight: photoZoom === 1 ? 'calc(100dvh - 140px)' : 'none',
          }}
        />
      </div>
      <div className="exd-lightbox-controls">
        <button
          onClick={() => setPhotoZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
          aria-label={t.zoomOut}
          disabled={photoZoom <= 1}
        >
          −
        </button>
        <span>{Math.round(photoZoom * 100)}%</span>
        <button
          onClick={() => setPhotoZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
          aria-label={t.zoomIn}
          disabled={photoZoom >= 3}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );

  // Edit affordance — only for a custom ("My exercises") entry, and only for a
  // role that can author the shared catalog (same gate as the gallery).
  const canEdit = getRole() === 'admin' || getRole() === 'trainer';
  const editButton =
    custom && canEdit ? (
      <button className="btn btn-secondary" onClick={() => setEditing(true)}>
        <Icon name="pencil-simple" />
        {t.libEditExercise}
      </button>
    ) : null;
  const editorSheet =
    editing && custom ? (
      <CustomEditor
        init={{
          id: custom.id,
          name: custom.name,
          primary: custom.primaryMuscle,
          secondary: custom.secondaryMuscles,
          equipment: custom.equipment,
        }}
        onClose={() => setEditing(false)}
        onSave={(v) => {
          updateCatalogExercise(custom.id, {
            name: v.name.trim(),
            kind: 'strength',
            primaryMuscle: v.primary,
            secondaryMuscles: v.secondary,
            equipment: v.equipment,
          });
          setEditing(false);
        }}
      />
    ) : null;

  // --- phone (RICH-1 / SPARSE-1) --------------------------------------------
  if (!isDesktop) {
    return (
      <div className="screen exd">
        <div className="exd-header">
          {renderMedia('phone')}
          <button className="exd-back" onClick={onClose} aria-label={t.backAction}>
            <Icon name="caret-left" />
          </button>
        </div>
        <div className="exd-body">
          {titleRow(false)}
          {musclesSection}
          {instructions}
          {formPhotos}
          {historySection}
          {alternativesSection}
          {editButton}
          <button className="btn btn-primary exd-add" onClick={addToSession}>
            <Icon name="plus" />
            {t.addToTodaySession}
          </button>
        </div>
        {lightbox}
        {editorSheet}
      </div>
    );
  }

  // --- desktop (RICH-2 / SPARSE) — media left, text right -------------------
  return (
    <div className="screen exd desktop">
      <div className="exd-top-row">
        <button className="back exd-back-top" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div className="exd-crumb">
          {t.exercisesTabLabel} / {canonical}
        </div>
      </div>
      <div className="exd-panes">
        <div className="exd-left">
          {renderMedia('16-9')}
          {formPhotos}
        </div>
        <div className="exd-right">
          {titleRow(true)}
          {musclesSection}
          {instructions}
          {historySection}
          {alternativesSection}
          <div className="exd-actions">
            <button
              className="btn btn-secondary"
              onClick={() => shell.openOverlay({ screen: 'exercise-history', name: canonical })}
            >
              {t.fullHistory}
            </button>
            {editButton}
            <button className="btn btn-primary" onClick={addToSession}>
              <Icon name="plus" />
              {t.addToTodaySession}
            </button>
          </div>
        </div>
      </div>
      {lightbox}
      {editorSheet}
    </div>
  );
}
