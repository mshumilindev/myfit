/** Trainer — design TR-01…TR-04. Assigned clients only, read-only. */
import { useCallback, useEffect, useState } from 'react';
import { request } from '../api';
import { fmtDayMonth, fmtTonnes, fmtSessionClock, useT } from '../i18n';
import { Icon, LanguageSelector, Spinner } from '../ui';
import { Avatar } from '../components/Avatar';
import { MemberDetailSheet } from './AdminView';

interface Client {
  id: string;
  name: string;
  avatar: boolean;
  lastSessionAt: number | null;
  live: boolean;
  liveStartedAt: number | null;
  liveSets: number;
  liveVolumeKg: number;
  weekSessions: number;
  weekVolumeKg: number;
  dormantDays: number | null;
}

export function TrainerView() {
  const { t, locale } = useT();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Client | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    request<{ clients: Client[] }>('GET', '/api/trainer/clients')
      .then((d) => setClients(d.clients))
      .catch(() => setFailed(true));
  }, []);

  // AC-TRAINER-06: live sessions update without manual refresh.
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
    };
  }, [refresh]);

  const liveCount = (clients ?? []).filter((c) => c.live).length;

  return (
    <div className="screen">
      <div className="tr-readonly-bar">
        <Icon name="shield-check" /> {t.trReadOnlyBar}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="kicker">{t.roleTrainer}</div>
          <h1 className="title-26">{t.trMyClients}</h1>
          {clients && <div className="sub">{t.trSummary(clients.length, liveCount)}</div>}
        </div>
        <LanguageSelector />
      </div>

      {clients === null && !failed && <Spinner size={18} />}
      {failed && (
        <div className="empty">
          <Icon name="warning-circle" />
          <div className="t">{t.error}</div>
          <button className="btn btn-secondary" onClick={refresh}>
            {t.retry}
          </button>
        </div>
      )}

      {clients !== null && clients.length === 0 && (
        <div className="empty">
          <Icon name="map-pin" />
          <div className="t">{t.trEmptyTitle}</div>
          <div className="s">{t.trEmptyBody}</div>
        </div>
      )}

      {(clients ?? []).map((c) => (
        <button
          key={c.id}
          className={`tr-client-card${c.dormantDays !== null ? ' dormant' : ''}${c.live ? ' live' : ''}`}
          onClick={() => setOpen(c)}
        >
          <Avatar userId={c.id} name={c.name} hasPhoto={c.avatar} size={40} />
          <span className="body">
            <span className="n">{c.name}</span>
            <span className="s">
              {c.live
                ? `${t.stTrainingNow} · ${fmtSessionClock(now - (c.liveStartedAt ?? now))} · ${c.liveSets} · ${fmtTonnes(c.liveVolumeKg)}`
                : c.dormantDays !== null
                  ? t.trDormantDays(c.dormantDays)
                  : c.lastSessionAt
                    ? `${t.trLastSession(fmtDayMonth(c.lastSessionAt, locale))} · ${fmtTonnes(c.weekVolumeKg)}`
                    : t.stNever}
            </span>
          </span>
          {c.live && <span className="live-dot" />}
          <Icon name="arrow-up-right" className="go" />
        </button>
      ))}

      {open && (
        <MemberDetailSheet
          person={{ id: open.id, name: open.name, avatar: open.avatar }}
          now={now}
          trainerMode
          onClose={() => setOpen(null)}
          onAddNote={async (text) => {
            await request('POST', `/api/trainer/clients/${open.id}/notes`, { text });
          }}
        />
      )}
    </div>
  );
}
