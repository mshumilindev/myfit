/**
 * Client page — the trainer's history-first view of one client (not their
 * profile). Opened from the clients strip on Today. Read-only: training history
 * first, then a compact stats row, top lifts, and trainer notes. No live
 * sessions (a trainer can't see those) — in-progress sessions are filtered out.
 */
import { useCallback, useEffect, useState } from 'react';
import { cachePeek, cacheSet, callFn } from '../api';
import { fmtDayMonth, fmtTonnes, useT } from '../i18n';
import { Icon } from '../ui';
import { Avatar } from '../components/Avatar';
import type { Shell } from '../App';

interface ClientData {
  person: { id: string; name: string; avatar: boolean; joinedAt: number };
  summary: {
    sessions30: number;
    sets: number;
    volume7: number;
    lastSessionAt: number | null;
  };
  sessions: Array<{
    id: string;
    startedAt: number;
    live: boolean;
    sets: number;
    exercises: number;
    volumeKg: number;
    gymName: string | null;
    exerciseNames: string[];
  }>;
  topExercises: Array<{
    name: string;
    sets: number;
    lastAt: number;
    volumeKg: number;
    bestE1rm: number | null;
  }>;
  notes: Array<{ id: string; text: string; createdAt: number; trainerName: string }>;
}

export function ClientPage({
  clientId,
  onClose,
}: {
  clientId: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const cacheKey = `profile.${clientId}`;
  const [data, setData] = useState<ClientData | null>(cachePeek<ClientData>(cacheKey)?.data ?? null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const refresh = useCallback(() => {
    callFn<ClientData>('profileUser', { id: clientId })
      .then((d) => {
        cacheSet(cacheKey, d);
        setData(d);
      })
      .catch(() => {
        /* keep cache */
      });
  }, [clientId, cacheKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addNote = async () => {
    const text = note.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      await callFn('trainerAddNote', { id: clientId, text });
      setNote('');
      refresh();
    } finally {
      setSavingNote(false);
    }
  };

  const sessions = (data?.sessions ?? []).filter((s) => !s.live);

  return (
    <div className="screen client-page">
      <div className="cp-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        {data && (
          <div className="cp-id">
            <Avatar userId={data.person.id} name={data.person.name} hasPhoto={data.person.avatar} size={52} />
            <div className="cp-id-text">
              <h2>{data.person.name}</h2>
              {data.summary.lastSessionAt && (
                <span>{t.trLastSession(fmtDayMonth(data.summary.lastSessionAt, locale))}</span>
              )}
            </div>
          </div>
        )}
      </div>

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

      <section className="cp-section">
        <div className="section-label">{t.clientHistory}</div>
        {sessions.length === 0 ? (
          <p className="cp-empty">{t.clientNoSessions}</p>
        ) : (
          <div className="cp-list">
            {sessions.map((s) => (
              <div key={s.id} className="cp-session">
                <div className="cp-session-top">
                  <span className="d">{fmtDayMonth(s.startedAt, locale)}</span>
                  {s.gymName && <span className="g">{s.gymName}</span>}
                </div>
                <div className="cp-session-meta">
                  {s.exercises} · {s.sets} {t.setsStat.toLowerCase()} · {fmtTonnes(s.volumeKg)}
                </div>
                {s.exerciseNames.length > 0 && (
                  <div className="cp-session-ex">{s.exerciseNames.slice(0, 4).join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
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

      {data && (
        <section className="cp-section">
          <div className="section-label">{t.clientNotesLabel}</div>
          <div className="cp-notes">
            {data.notes.map((n) => (
              <div key={n.id} className="cp-note">
                <span className="txt">{n.text}</span>
                <span className="meta">
                  {n.trainerName} · {fmtDayMonth(n.createdAt, locale)}
                </span>
              </div>
            ))}
            <div className="cp-note-add">
              <input
                className="input"
                placeholder={t.trAddNote}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <button
                className="btn btn-secondary"
                disabled={savingNote || !note.trim()}
                onClick={addNote}
              >
                <Icon name="plus" />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
