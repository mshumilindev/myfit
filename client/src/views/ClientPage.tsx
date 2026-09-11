/**
 * Client page — the trainer's history-first view of one client (not their
 * profile). Opened from the clients strip on Today. Read-only: a highlighted
 * "last time on this weekday" card, then the full training history, a compact
 * stats row and top lifts. No live sessions (a trainer can't see those) — any
 * in-progress session is filtered out. Every session opens the read-only
 * session detail (all exercises expanded).
 *
 * Cached like the rest of the app: paints instantly from localStorage, skips the
 * network while the cache is fresh, and only re-renders on a real change (delta).
 */
import { useCallback, useEffect, useState } from 'react';
import { cacheFresh, cachePeek, cacheSet, callFn } from '../api';
import { fmtDayMonth, fmtTonnes, fmtWeekday, useT } from '../i18n';
import type { Strings } from '../i18n/en';
import { muscleInfoByName } from '../data/exercises';
import { useStore } from '../store';
import { classifyTrainee } from '../trainerLive';
import { Icon } from '../ui';
import { Avatar } from '../components/Avatar';
import { HistoryTimeline } from '../components/HistoryTimeline';
import type { Activity, RestPeriod, SleepNight, Workout } from '../types';
import type { Shell } from '../App';

const NO_DAYS = new Set<number>();

/** Fallback grouping (pre-deploy, when the backend hasn't sent full history):
 *  bucket the summarised sessions by calendar day, newest first. */
function groupByDay(
  sessions: ClientSession[],
): { key: string; ts: number; sessions: ClientSession[] }[] {
  const map = new Map<string, { key: string; ts: number; sessions: ClientSession[] }>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = map.get(key);
    if (!g) {
      g = { key, ts: s.startedAt, sessions: [] };
      map.set(key, g);
    }
    g.sessions.push(s);
    if (s.startedAt > g.ts) g.ts = s.startedAt;
  }
  return [...map.values()].sort((a, b) => b.ts - a.ts);
}

interface ClientSession {
  id: string;
  startedAt: number;
  live: boolean;
  sets: number;
  exercises: number;
  volumeKg: number;
  gymName: string | null;
  dayName: string | null;
  exerciseNames: string[];
}

interface ClientData {
  person: { id: string; name: string; avatar: boolean; avatarRev: number; joinedAt: number };
  summary: {
    sessions30: number;
    sets: number;
    volume7: number;
    lastSessionAt: number | null;
  };
  sessions: ClientSession[];
  topExercises: Array<{
    name: string;
    sets: number;
    lastAt: number;
    volumeKg: number;
    bestE1rm: number | null;
  }>;
  history?: {
    workouts: Workout[];
    activities: Activity[];
    sleeps: SleepNight[];
    restPeriods: RestPeriod[];
  };
}

const PROFILE_TTL_MS = 3 * 60 * 1000;

/** A display title for a session: the program day it came from, else the
 *  dominant muscle group across its exercises, else the first exercise. */
function workoutTitle(s: ClientSession, t: Strings): string {
  if (s.dayName && s.dayName.trim()) return s.dayName.trim();
  const tally = new Map<string, number>();
  for (const nm of s.exerciseNames) {
    const g = muscleInfoByName(nm)?.primary;
    if (g) tally.set(g, (tally.get(g) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [g, n] of tally) {
    if (n > bestN) {
      best = g;
      bestN = n;
    }
  }
  if (best) return t.muscleGroups[best as keyof typeof t.muscleGroups] ?? best;
  return s.exerciseNames[0] ?? t.playUntitled;
}

export function ClientPage({
  clientId,
  shell,
  onClose,
}: {
  clientId: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [todayDow] = useState(() => new Date().getDay());
  const [liveNow, setLiveNow] = useState(() => Date.now());
  useEffect(() => {
    const tm = setInterval(() => setLiveNow(Date.now()), 30000);
    return () => clearInterval(tm);
  }, []);
  const isLive = useStore().liveTrainees.some(
    (s) => s.id === clientId && classifyTrainee(s, liveNow) === 'live',
  );
  const cacheKey = `profile.${clientId}`;
  const [data, setData] = useState<ClientData | null>(
    cachePeek<ClientData>(cacheKey)?.data ?? null,
  );

  const refresh = useCallback(() => {
    if (cacheFresh(cachePeek<ClientData>(cacheKey), PROFILE_TTL_MS)) return;
    callFn<ClientData>('profileUser', { id: clientId })
      .then((d) => {
        const prev = cachePeek<ClientData>(cacheKey)?.data;
        cacheSet(cacheKey, d);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(d)) setData(d);
      })
      .catch(() => {
        /* keep cache */
      });
  }, [clientId, cacheKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sessions = (data?.sessions ?? []).filter((s) => !s.live);
  // Most recent finished session on the same weekday the trainer is viewing.
  const sameDay = sessions.find((s) => new Date(s.startedAt).getDay() === todayDow);

  const openSession = (s: ClientSession) => {
    if (!data) return;
    shell.openOverlay({
      screen: 'trainee-session',
      athleteId: clientId,
      workoutId: s.id,
      athleteName: data.person.name,
    });
  };

  return (
    <div className="screen client-page">
      <div className="cp-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        {data && (
          <div className="cp-id">
            <Avatar
              userId={data.person.id}
              name={data.person.name}
              hasPhoto={data.person.avatar}
              rev={data.person.avatarRev}
              size={52}
            />
            <div className="cp-id-text">
              <h2>{data.person.name}</h2>
              {data.summary.lastSessionAt && (
                <span>{t.trLastSession(fmtDayMonth(data.summary.lastSessionAt, locale))}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {isLive && (
        <div className="cp-live">
          <span className="cp-live-dot" aria-hidden />
          <div className="cp-live-text">
            <div className="cp-live-title">{t.clientLiveTitle}</div>
            <div className="cp-live-body">{t.clientLiveBody}</div>
          </div>
        </div>
      )}
      {sameDay && (
        <button className="cp-sameday" onClick={() => openSession(sameDay)}>
          <div className="cp-sameday-label">
            <Icon name="clock-counter-clockwise" />
            <span>
              {t.clientSameDayLabel} · {fmtWeekday(sameDay.startedAt, locale)}
            </span>
          </div>
          <div className="cp-sameday-name">{workoutTitle(sameDay, t)}</div>
          <div className="cp-sameday-meta">
            {fmtDayMonth(sameDay.startedAt, locale)} · {sameDay.exercises} · {sameDay.sets}{' '}
            {t.setsStat.toLowerCase()}
          </div>
          <Icon name="caret-right" className="cp-sameday-go" />
        </button>
      )}

      {data && (
        <div className="cp-stats">
          <div className="cell">
            <div className="v">{data.summary.sessions30}</div>
            <div className="l">{t.gymStatSessions}</div>
          </div>
          <div className="cell">
            <div className="v">{fmtTonnes(data.summary.volume7)}</div>
            <div className="l">{t.trStat7Days}</div>
          </div>
          <div className="cell">
            <div className="v">{data.summary.sets}</div>
            <div className="l">{t.setsStat}</div>
          </div>
        </div>
      )}

      {data && (
        <button
          className="cp-profile-btn"
          onClick={() => shell.openOverlay({ screen: 'profile', userId: clientId })}
        >
          <Icon name="user" />
          <span>{t.clientOpenProfile}</span>
          <Icon name="arrow-up-right" className="cp-profile-go" />
        </button>
      )}

      <section className="cp-section">
        <div className="section-label">{t.clientHistory}</div>
        {data?.history &&
        data.history.workouts.length + data.history.activities.length + data.history.sleeps.length >
          0 ? (
          <HistoryTimeline
            workouts={data.history.workouts}
            activities={data.history.activities}
            sleeps={data.history.sleeps}
            allWorkouts={data.history.workouts}
            bodyKg={null}
            restPeriodsOverride={data.history.restPeriods}
            prescribedDaysOverride={NO_DAYS}
            lookbackOverride={0}
            onOpenWorkout={(id) =>
              shell.openOverlay({
                screen: 'trainee-session',
                athleteId: clientId,
                workoutId: id,
                athleteName: data.person.name,
              })
            }
          />
        ) : sessions.length > 0 ? (
          <div className="hist-tl">
            {groupByDay(sessions).map((day, i, arr) => (
              <div
                className={`hist-tl-day st-trained${i === arr.length - 1 ? ' is-last' : ''}`}
                key={day.key}
              >
                <div className="hist-tl-rail">
                  <span className="hist-tl-node">
                    <Icon name="check" />
                  </span>
                  <span className="hist-tl-line" />
                </div>
                <div className="hist-tl-body">
                  <div className="hist-tl-head">
                    <span className="hist-tl-date">{fmtDayMonth(day.ts, locale)}</span>
                  </div>
                  {day.sessions.map((s) => (
                    <button
                      key={s.id}
                      className="hist-item hist-workout"
                      onClick={() => openSession(s)}
                    >
                      <span className="hist-item-body">
                        <span className="hist-item-name">{workoutTitle(s, t)}</span>
                        <div className="hist-item-stats">
                          {s.gymName ? `${s.gymName} · ` : ''}
                          {s.exercises} · {s.sets} {t.setsStat.toLowerCase()} ·{' '}
                          {fmtTonnes(s.volumeKg)}
                        </div>
                        {s.exerciseNames.length > 0 && (
                          <div className="hist-item-stats">
                            {s.exerciseNames.slice(0, 4).join(' · ')}
                          </div>
                        )}
                      </span>
                      <Icon name="arrow-up-right" className="go" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="cp-empty">{t.clientNoSessions}</p>
        )}
      </section>

      {data && data.topExercises.length > 0 && (
        <section className="cp-section">
          <div className="section-label">{t.clientTopLifts}</div>
          <div className="cp-lifts">
            {data.topExercises.slice(0, 6).map((e) => (
              <div key={e.name} className="cp-lift">
                <div className="cp-lift-name">
                  <span className="n">{e.name}</span>
                  <span className="s">{fmtDayMonth(e.lastAt, locale)}</span>
                </div>
                <span className="cp-lift-val">
                  {e.bestE1rm ? `${Math.round(e.bestE1rm)} kg` : fmtTonnes(e.volumeKg)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
