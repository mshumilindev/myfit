/**
 * Exercise detail (design RICH / SPARSE; MEDIA-1…5).
 *
 * The page reads the full record and degrades gracefully. A base lift (RICH)
 * shows classification badges (category/mechanic/force/level/equipment), the
 * muscle silhouette with primary in brass and secondary in grey, the public-
 * domain form photos (landscape), numbered instructions and the derived
 * history block. A curated-only lift (SPARSE) drops every absent block — no
 * dash, no empty card — keeps name + primary muscle + equipment, shows a single
 * quiet explainer, and still renders history (it is derived from logs, not the
 * base record). The media header degrades video → form photo → barbell glyph;
 * a greyed player never appears. "Add to today's session" makes the page a
 * route into logging, not a dead end (AC-DET-06).
 */
import { useMemo } from 'react';
import {
  canonicalExerciseName,
  muscleInfoByName,
  richExerciseByName,
  type MuscleGroup,
} from '../data/exercises';
import { equipmentIconName, equipmentLabel, MuscleBodyFigure } from '../components/Muscle';
import { clipLen, clipSourceUrl, exerciseMedia } from '../data/exerciseMedia';
import { addExercise, est1rm, recordWeight, startWorkout, topSet, useStore } from '../store';
import { useT } from '../i18n';
import { Icon, useIsDesktop } from '../ui';
import type { Shell } from '../App';

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = 'none';
};

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

  const canonical = canonicalExerciseName(name);
  const info = muscleInfoByName(canonical);
  const rich = richExerciseByName(canonical);
  const media = exerciseMedia(canonical);
  const curated = !rich;

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
      const top = ex && topSet(ex.sets);
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

  function addToSession() {
    const open = store.workouts.find((w) => w.finishedAt === null);
    const w = open ?? startWorkout(null);
    addExercise(w.id, canonical, 'strength');
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }

  const openSource = () => window.open(clipSourceUrl(canonical), '_blank', 'noopener');

  // --- classification badges (RICH) / equipment-only (SPARSE) ---------------
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
                <span key={m} className="badge b-mus-pri">
                  {t.muscleGroups[m]}
                </span>
              ))}
            </div>
          )}
          {secondaries.length > 0 && (
            <div className="exd-mrow-badges">
              {secondaries.map((m) => (
                <span key={m} className="badge b-mus">
                  {t.muscleGroups[m]}
                </span>
              ))}
            </div>
          )}
          <div className="exd-mlegend">{curated ? t.sparseMusclesNote : t.musclesLegend}</div>
        </div>
      </div>
    </div>
  );

  const instructions = rich && rich.instructions.length > 0 && (
    <div className="exd-section">
      <h6 className="exd-label">{t.instructionsLabel}</h6>
      <div className="exd-instr-list">
        {rich.instructions.map((step, i) => (
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
          <div className="exd-formphoto" key={src}>
            <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} onError={hideBroken} />
            <span className="exd-photo-label">{i === 0 ? t.photoStart : t.photoEnd}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const sparseExplainer = curated && (
    <div className="exd-sparse">
      <Icon name="info" />
      <p>{t.sparseExplainer}</p>
    </div>
  );

  const historySection = (
    <div className="exd-section">
      <h6 className="exd-label">{t.detailFromHistory}</h6>
      <div className={`exd-tiles ${curated ? 'n2' : 'n4'}`}>
        <div className="exd-tile">
          <div className="exd-tile-num ok">{record > 0 ? record : '—'}</div>
          <div className="exd-tile-label">{t.recordKg}</div>
        </div>
        {!curated && (
          <div className="exd-tile">
            <div className="exd-tile-num">{est > 0 ? est : '—'}</div>
            <div className="exd-tile-label">{t.est1rmLabel}</div>
          </div>
        )}
        <div className="exd-tile">
          <div className="exd-tile-num">{sessions.length}</div>
          <div className="exd-tile-label">{t.detailSessions}</div>
        </div>
        {!curated && (
          <div className="exd-tile">
            <div className="exd-tile-num">{lastTop > 0 ? lastTop : '—'}</div>
            <div className="exd-tile-label">{t.lastTop}</div>
          </div>
        )}
      </div>
      {curated && <div className="exd-note">{t.historyDerivedNote}</div>}
      {!curated && available && equipment && (
        <div className="exd-avail">
          <Icon name="check-circle" weight="bold" />
          {t.availableAtGymLine(equipmentLabel(equipment))}
        </div>
      )}
    </div>
  );

  const providerBar = media.kind === 'clip' && media.clip && (
    <div className="exd-provider">
      <Icon name="youtube-logo" />
      <span className="exd-provider-txt">
        {t.demonstration} · {media.clip.provider}
        {isDesktop ? ` · ${t.embeddedAttribution}` : ''}
      </span>
      <button className="exd-open" onClick={openSource}>
        {isDesktop ? t.openSource : t.openAction}
      </button>
    </div>
  );

  // --- media header: video → form photo → barbell glyph ---------------------
  const renderVideo = (ratio: '16-9' | 'phone') => {
    if (media.kind === 'clip') {
      const len = media.clip ? clipLen(media.clip.lenSec) : '';
      return (
        <button
          className={`exd-video clip ${ratio}`}
          onClick={openSource}
          aria-label={t.openAction}
        >
          <span className="exd-playbtn">
            <Icon name="play" weight="fill" />
          </span>
          <span className="exd-scrub">
            <span className="exd-time">0:00</span>
            <span className="exd-track">
              <span className="exd-fill" />
            </span>
            <span className="exd-time">{len}</span>
            <Icon name="speaker-simple-slash" className="exd-mute" />
          </span>
        </button>
      );
    }
    if (rich?.images[0]) {
      return (
        <div className={`exd-video photo ${ratio}`}>
          <img src={rich.images[0]} alt="" onError={hideBroken} />
        </div>
      );
    }
    return (
      <div className={`exd-video none ${ratio}`}>
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
        {curated && <span className="badge b-ghost">{t.libCuratedTag}</span>}
      </div>
      {badgesRow}
    </div>
  );

  // --- phone (RICH-1 / SPARSE-1) --------------------------------------------
  if (!isDesktop) {
    return (
      <div className="screen exd">
        <div className="exd-header">
          {renderVideo('phone')}
          <button className="exd-back" onClick={onClose} aria-label={t.backAction}>
            <Icon name="caret-left" />
          </button>
        </div>
        {providerBar}
        <div className="exd-body">
          {titleRow(false)}
          {musclesSection}
          {sparseExplainer}
          {instructions}
          {formPhotos}
          {historySection}
          <button className="btn btn-primary exd-add" onClick={addToSession}>
            <Icon name="plus" />
            {t.addToTodaySession}
          </button>
        </div>
      </div>
    );
  }

  // --- desktop (RICH-2 / SPARSE) — media left, text right -------------------
  return (
    <div className="screen exd desktop">
      <button className="back exd-back-top" onClick={onClose} aria-label={t.backAction}>
        <Icon name="caret-left" />
      </button>
      <div className="exd-panes">
        <div className="exd-left">
          <div className="exd-crumb">
            {t.exercisesTabLabel} / {canonical}
          </div>
          {renderVideo('16-9')}
          {providerBar}
          {formPhotos}
        </div>
        <div className="exd-right">
          {titleRow(true)}
          {musclesSection}
          {sparseExplainer}
          {instructions}
          {historySection}
          <div className="exd-actions">
            <button
              className="btn btn-secondary"
              onClick={() => shell.openOverlay({ screen: 'exercise-history', name: canonical })}
            >
              {t.fullHistory}
            </button>
            <button className="btn btn-primary" onClick={addToSession}>
              <Icon name="plus" />
              {t.addToTodaySession}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
