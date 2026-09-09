/**
 * Coach's live-athlete banner (Today). While an athlete this trainer coaches is
 * training, their session shows here in real time — the freshest as a big
 * banner, the rest as compact rows — until they finish. Tap opens the athlete's
 * profile. Mirrors the athlete's own live-session hero (design: trainer-live).
 */
import { useEffect, useState } from 'react';
import type { Shell } from '../App';
import type { LiveSession } from '../types';
import { activeTrainees, type LiveState, type TraineeCard } from '../trainerLive';
import { useT, fmtSessionClock, fmtTonnes, fmtDayMonth } from '../i18n';
import type { Strings } from '../i18n/en';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function elapsed(s: LiveSession, now: number): number {
  const end = s.finishedAt ?? now;
  return Math.max(0, end - s.startedAt);
}
function stateLabel(t: Strings, state: LiveState): string {
  if (state === 'offline') return t.trLiveOffline;
  if (state === 'finished') return t.trLiveFinished;
  return t.trLiveTrainingNow;
}

function LastLine({ s, t }: { s: LiveSession; t: Strings }) {
  if (s.finishedAt != null) {
    return (
      <span>
        {s.finalSets ?? s.exerciseCount ?? 0} {t.sets} · {fmtTonnes(s.finalTonnageKg ?? 0)}
      </span>
    );
  }
  if (!s.lastName && !s.lastSets) return <span>{t.trLiveNoLast}</span>;
  return (
    <span>
      {t.trLiveLast} <span className="k">{s.lastName ?? '—'}</span> · {s.lastSets ?? 0} {t.sets} ·{' '}
      {fmtTonnes(s.lastTonnageKg ?? 0)}
      {s.lastAt ? ` · ${fmtDayMonth(s.lastAt)}` : ''}
    </span>
  );
}

function BigCard({
  card,
  now,
  onOpen,
  onMain,
  t,
}: {
  card: TraineeCard;
  now: number;
  onOpen: (id: string) => void;
  onMain: (card: TraineeCard) => void;
  t: Strings;
}) {
  const { s, state } = card;
  const action = state === 'finished' ? t.trLiveViewRecap : t.trLiveView;
  return (
    <div className={`trlive-hero ${state}`}>
      <div className="trlive-hero-bg" aria-hidden="true" />
      <div className="trlive-hero-scrim" aria-hidden="true" />
      <div className="trlive-hero-in">
        <div className="trlive-line">
          <span className={`trlive-dot ${state}`} aria-hidden="true" />
          <span className="trlive-lbl">
            <b className={state}>{stateLabel(t, state)}</b>
            {s.gymName ? ` · ${s.gymName}` : ''}
          </span>
          <button className="trlive-prof" aria-label={t.trLiveProfile} onClick={() => onOpen(s.id)}>
            <svg viewBox="0 0 24 24" className="ic">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="4" />
            </svg>
          </button>
        </div>
        <button className="trlive-row" onClick={() => onMain(card)}>
          <span className="trlive-ava-lg">{initials(s.athleteName)}</span>
          <span className="trlive-who">
            <span className="trlive-name">{s.athleteName}</span>
            <span className="trlive-since">
              {state === 'offline'
                ? t.trLiveReconnecting
                : `${t.trLiveStarted(hhmm(s.startedAt))} · ${t.trLiveExercisesIn(s.exerciseCount ?? 0)}`}
            </span>
          </span>
          <span className={`trlive-timer${state === 'offline' ? ' muted' : ''}`}>
            {fmtSessionClock(elapsed(s, now))}
          </span>
        </button>
        <button className="trlive-last" onClick={() => onMain(card)}>
          <LastLine s={s} t={t} />
          <span className={`trlive-go${state === 'finished' ? ' ok' : ''}`}>
            {action}
            <svg viewBox="0 0 24 24" className="ic-sm">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}

function CompactRow({
  card,
  now,
  onMain,
  t,
}: {
  card: TraineeCard;
  now: number;
  onMain: (card: TraineeCard) => void;
  t: Strings;
}) {
  const { s, state } = card;
  return (
    <button className={`trlive-crow ${state}`} onClick={() => onMain(card)}>
      <span className="trlive-ava-sm">{initials(s.athleteName)}</span>
      <span className="trlive-cwho">
        <span className="trlive-cname">{s.athleteName}</span>
        <span className="trlive-csub">
          <span className={`trlive-dot ${state}`} aria-hidden="true" />
          {state === 'offline' ? t.trLiveOffline : stateLabel(t, state)}
          {s.gymName ? ` · ${s.gymName}` : ''}
        </span>
      </span>
      <span className={`trlive-ctimer${state === 'offline' ? ' muted' : ''}`}>
        {fmtSessionClock(elapsed(s, now))}
      </span>
      <svg viewBox="0 0 24 24" className="ic-sm trlive-caret">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function TrainerLiveBanner({ trainees, shell }: { trainees: LiveSession[]; shell: Shell }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cards = activeTrainees(trainees, now);
  if (cards.length === 0) return null;
  const [big, ...rest] = cards;
  const liveCount = cards.filter((c) => c.state !== 'finished').length;
  const open = (id: string) => shell.openOverlay({ screen: 'profile', userId: id });
  const openMain = (card: TraineeCard) => {
    const s = card.s;
    if (card.state === 'finished' && s.workoutId)
      shell.openOverlay({
        screen: 'trainee-session',
        athleteId: s.id,
        workoutId: s.workoutId,
        athleteName: s.athleteName,
      });
    else shell.openOverlay({ screen: 'profile', userId: s.id });
  };

  return (
    <div className="trlive">
      <div className="trlive-sec">
        <span className="trlive-sec-l">{t.trLiveAthletes}</span>
        {liveCount > 0 && (
          <span className="trlive-count">
            <span className="trlive-cd" aria-hidden="true" />
            {t.trLiveCount(liveCount)}
          </span>
        )}
      </div>
      <BigCard card={big} now={now} onOpen={open} onMain={openMain} t={t} />
      {rest.length > 0 && (
        <>
          <div className="trlive-sec">
            <span className="trlive-sec-l">{t.trLiveAlso}</span>
          </div>
          <div className="trlive-rows">
            {rest.map((c) => (
              <CompactRow key={c.s.id} card={c} now={now} onMain={openMain} t={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
