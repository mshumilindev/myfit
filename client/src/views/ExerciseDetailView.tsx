/**
 * Exercise detail (design DET-1 phone, DET-2 web; MEDIA-1…5).
 *
 * Video is the header — muted, tap-to-play, never autoplaying with sound
 * (AC-DET-01). The provider is named on a bar directly beneath it with an
 * Open link to the source (AC-DET-02). Form stills render as an ordered
 * set-up → bottom → drive → lockout sequence (AC-DET-03). Cues are the app's
 * own copy; muscles and equipment follow the chip grammar (AC-DET-04). Desktop
 * is media-left / text-right, phone stacks (AC-DET-05). "Add to today's
 * session" is the primary action — the page is a route into logging, not a
 * dead end (AC-DET-06).
 */
import { canonicalExerciseName, muscleInfoByName, type MuscleGroup } from '../data/exercises';
import { equipmentIconName, equipmentLabel } from '../components/Muscle';
import { clipLen, clipSourceUrl, exerciseMedia } from '../data/exerciseMedia';
import { addExercise, recordWeight, startWorkout, topSet, useStore } from '../store';
import { useT } from '../i18n';
import { Icon, useIsDesktop } from '../ui';
import { HouseGraphic } from '../components/HouseGraphic';
import type { Shell } from '../App';

const STILL_KEYS = ['stillSetup', 'stillBottom', 'stillDrive', 'stillLockout'] as const;

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
  const media = exerciseMedia(canonical);
  const primary: MuscleGroup | null = info && info.primary !== 'cardio' ? info.primary : null;
  const secondary = info?.secondary ?? [];
  const equipment = info?.equipment ?? null;

  // History (AC-DET reuses the same figures as the history screen).
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

  function addToSession() {
    const open = store.workouts.find((w) => w.finishedAt === null);
    const w = open ?? startWorkout(null);
    addExercise(w.id, canonical, 'strength');
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }

  const openSource = () => window.open(clipSourceUrl(canonical), '_blank', 'noopener');

  // --- shared pieces --------------------------------------------------------
  const chips = (
    <div className="exd-chips">
      {primary && <span className="exd-chip primary">{t.muscleGroups[primary]}</span>}
      {secondary.map((m) => (
        <span key={m} className="exd-chip">
          {t.muscleGroups[m]}
        </span>
      ))}
      {equipment && (
        <span className="exd-chip">
          <Icon name={equipmentIconName(equipment)} />
          {equipmentLabel(equipment)}
        </span>
      )}
    </div>
  );

  const cues = media.cues && media.cues.length > 0 && (
    <div className="exd-section">
      <h6 className="exd-label">{t.cuesLabel}</h6>
      <div className="exd-cues">
        {media.cues.map((c, i) => (
          <div className="exd-cue" key={i}>
            <Icon name="circle" weight="fill" className="exd-bullet" />
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const historyTiles = (
    <div className="exd-section">
      <h6 className="exd-label">{t.yourHistory}</h6>
      <div className="exd-tiles">
        <div className="exd-tile">
          <div className="exd-tile-num ok">{record > 0 ? record : '—'}</div>
          <div className="exd-tile-label">{t.recordKg}</div>
        </div>
        <div className="exd-tile">
          <div className="exd-tile-num">{lastTop > 0 ? lastTop : '—'}</div>
          <div className="exd-tile-label">{t.lastTop}</div>
        </div>
        <div className="exd-tile">
          <div className="exd-tile-num">{sessions.length}</div>
          <div className="exd-tile-label">{t.detailSessions}</div>
        </div>
      </div>
    </div>
  );

  const stillTiles = (count: number, big: boolean) => (
    <div className={`exd-stills${big ? ' big' : ''}`}>
      {STILL_KEYS.slice(0, count).map((k, i) => (
        <div
          key={k}
          className="exd-still"
          style={{ background: i % 2 === 1 ? 'var(--frame2)' : 'var(--frame)' }}
        >
          <span className="exd-still-label">{t[k]}</span>
        </div>
      ))}
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

  // --- video / media header -------------------------------------------------
  const renderVideo = (ratio: '16-9' | 'phone') => {
    if (media.kind === 'none') {
      return (
        <div className={`exd-video none ${ratio}`}>
          <div className="exd-house">
            <HouseGraphic size={ratio === '16-9' ? 160 : 120} />
          </div>
        </div>
      );
    }
    if (media.kind === 'stills') {
      // Stills promoted to the header — no play button (AC-MEDIA-02).
      return <div className={`exd-video stills ${ratio}`}>{stillTiles(4, true)}</div>;
    }
    const len = media.clip ? clipLen(media.clip.lenSec) : '';
    return (
      <button className={`exd-video clip ${ratio}`} onClick={openSource} aria-label={t.openAction}>
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
  };

  // --- phone (DET-1) --------------------------------------------------------
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
          <div>
            <h2 className="exd-title">{canonical}</h2>
            {chips}
          </div>
          {media.kind === 'clip' && media.stills > 0 && (
            <div className="exd-section">
              <h6 className="exd-label">{t.formSequence}</h6>
              {stillTiles(3, false)}
              <div className="exd-stills-cap">{t.stillsMediaCaption}</div>
            </div>
          )}
          {cues}
          {historyTiles}
          <button className="btn btn-primary exd-add" onClick={addToSession}>
            <Icon name="plus" />
            {t.addToTodaySession}
          </button>
        </div>
      </div>
    );
  }

  // --- desktop (DET-2) — media left, text right ----------------------------
  return (
    <div className="screen exd desktop">
      <button className="back exd-back-top" onClick={onClose} aria-label={t.backAction}>
        <Icon name="caret-left" />
      </button>
      <div className="exd-panes">
        <div className="exd-left">
          {renderVideo('16-9')}
          {providerBar}
          {media.stills > 0 && (
            <div className="exd-section">
              <h6 className="exd-label">{t.formStillsLabel}</h6>
              {stillTiles(4, false)}
            </div>
          )}
        </div>
        <div className="exd-right">
          <div className="exd-crumb">
            {t.exercisesTabLabel} / {canonical}
          </div>
          <h2 className="exd-title lg">{canonical}</h2>
          {chips}
          {cues}
          {historyTiles}
          <div className="exd-actions">
            <button
              className="btn btn-secondary"
              onClick={() => shell.openOverlay({ screen: 'exercise-history', name: canonical })}
            >
              {t.fullHistory}
            </button>
            <button className="btn btn-primary" onClick={addToSession}>
              {t.addToTodaySession}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
