/**
 * Live-session hero (design G-08…G-12, AC-HERO-*). A full-bleed photo/logo band
 * mounted above the router outlet on every screen while a session is open, so an
 * open session is never invisible. Shows the gym photo, a pulsing live dot, the
 * running timer (from persisted startedAt), and Resume. When no gym is attached
 * it runs on the house graphic and offers to attach one; offline turns the dot
 * and hairline ruby; an auto-closed session turns graphite with Reopen.
 */
import { useEffect, useState } from 'react';
import type { Gym, Workout } from '../types';
import { attachGymToWorkout, workoutSets, workoutVolumeKg } from '../store';
import { fmtSessionClock, fmtTonnes, useT } from '../i18n';
import { Icon } from '../ui';
import { GymThumb } from './GymThumb';
import { GymPicker } from './GymPicker';

export function LiveHero({
  workout,
  gym,
  gyms,
  offline,
  queued,
  onResume,
  mode = 'compact',
}: {
  workout: Workout;
  gym: Gym | null;
  gyms: Gym[];
  offline: boolean;
  queued: number;
  onResume?: () => void;
  mode?: 'today' | 'session' | 'compact';
}) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState(false);
  const closed = workout.autoFinished || workout.finishedAt !== null;

  useEffect(() => {
    if (closed) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [closed]);

  const elapsed = (workout.finishedAt ?? now) - workout.startedAt;
  const state = closed ? 'closed' : offline ? 'offline' : 'live';
  const label = closed
    ? t.liveClosedAuto
    : offline
      ? `${t.liveLabel} · ${t.liveOfflineQueued(queued)}`
      : `${t.liveLabel} · ${gym ? gym.name : t.liveNoGym}`;
  const interactive = mode !== 'session' && !!onResume;
  const body = (
    <>
      <div className="live-hero-line">
        <span className="live-dot" aria-hidden />
        <span className="live-label">{label}</span>
      </div>
      <div className="live-hero-stats">
        <span className="live-timer">{fmtSessionClock(elapsed)}</span>
        <span className="live-meta">
          {workoutSets(workout)} · {fmtTonnes(workoutVolumeKg(workout))}
        </span>
      </div>
    </>
  );

  return (
    <div className={`live-hero ${state} ${mode}-live-hero`}>
      <div className="live-hero-bg">
        {gym ? (
          <GymThumb name={gym.name} lat={gym.lat} lng={gym.lng} size={320} />
        ) : (
          <GymThumb name="" lat={0} lng={0} size={320} />
        )}
      </div>
      <div className="live-hero-scrim" />
      {interactive ? (
        <button className="live-hero-body" onClick={onResume}>
          {body}
        </button>
      ) : (
        <div className="live-hero-body">{body}</div>
      )}
      <div className="live-hero-actions">
        {!gym && !closed && (
          <button className="live-attach" onClick={() => setPicker(true)}>
            <Icon name="map-pin" />
            {t.liveAttach}
          </button>
        )}
        {mode !== 'session' && (
          <button className="live-resume" onClick={onResume}>
            {closed ? t.liveReopen : t.liveResume}
          </button>
        )}
      </div>
      {picker && (
        <GymPicker
          gyms={gyms}
          title={t.pickGymTitle}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            attachGymToWorkout(workout.id, id);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
