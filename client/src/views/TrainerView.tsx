/** Trainer — design TR-01…TR-04. Assigned clients only, read-only. */
import { useCallback, useEffect, useState } from 'react';
import { request } from '../api';
import { fmtDayMonth, fmtTonnes, fmtSessionClock, useT } from '../i18n';
import { Icon, Spinner } from '../ui';
import { Avatar } from '../components/Avatar';

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
  weekDeltaPct?: number | null;
  programName?: string | null;
  programWeek?: number | null;
  dormantDays: number | null;
}

export function TrainerView({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { t, locale } = useT();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const selected = clients?.find((c) => c.id === selectedId) ?? clients?.[0] ?? null;

  return (
    <div className="screen trainer-page">
      <div className="tr-readonly-bar">
        <Icon name="eye" /> {t.trReadOnlyBar}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="kicker">{t.roleTrainer}</div>
          <h2 className="title-26">{t.trMyClients}</h2>
          {clients && <div className="sub">{t.trSummary(clients.length, liveCount)}</div>}
        </div>
      </div>

      {clients === null && !failed && <Spinner size={18} />}
      {failed && (
        <div className="empty">
          <Icon name="warning-circle" />
          <h4 className="t">{t.error}</h4>
          <button className="btn btn-secondary" onClick={refresh}>
            {t.retry}
          </button>
        </div>
      )}

      {clients !== null && clients.length === 0 && (
        <div className="empty">
          <Icon name="barbell" />
          <h4 className="t">{t.trEmptyTitle}</h4>
          <p className="s">{t.trEmptyBody}</p>
        </div>
      )}

      {clients !== null && clients.length > 0 && (
        <div className="trainer-workspace">
          <div className="trainer-client-list">
            {clients.map((c) => (
              <button
                key={c.id}
                className={`tr-client-card${c.dormantDays !== null ? ' dormant' : ''}${
                  c.live ? ' live' : ''
                }${selected?.id === c.id ? ' selected' : ''}`}
                onMouseEnter={() => setSelectedId(c.id)}
                onFocus={() => setSelectedId(c.id)}
                onClick={() => onOpenProfile(c.id)}
              >
                {c.live ? (
                  <span className="tr-card-photo" aria-hidden>
                    <span className="tr-card-live">
                      <span className="live-dot" />
                      {t.stTrainingNow} · {fmtSessionClock(now - (c.liveStartedAt ?? now))}
                    </span>
                  </span>
                ) : (
                  <span className="tr-card-thumb">
                    <Avatar userId={c.id} name={c.name} hasPhoto={c.avatar} size={52} />
                  </span>
                )}
                <span className="body">
                  {c.live && (
                    <span className="tr-card-avatar">
                      <Avatar userId={c.id} name={c.name} hasPhoto={c.avatar} size={38} />
                    </span>
                  )}
                  <span className="n">{c.name}</span>
                  <span className="s">{clientMeta(c, locale, t)}</span>
                </span>
                <Icon name="caret-right" className="go" />
              </button>
            ))}
          </div>

          <section className="trainer-week-table" aria-label={t.trWeekAcrossClients}>
            <div className="section-label">{t.trWeekAcrossClients}</div>
            <div className="trainer-table">
              <div className="trainer-table-head">
                <span>{t.trClient}</span>
                <span>{t.gymStatSessions}</span>
                <span>{t.moved}</span>
                <span>{t.trVsLastWeek}</span>
                <span>{t.progTitle}</span>
                <span>{t.trLastSeen}</span>
              </div>
              {clients.map((c, index) => (
                <button
                  key={c.id}
                  className="trainer-table-row"
                  aria-label={`${t.trWeekAcrossClients} ${index + 1}`}
                  onMouseEnter={() => setSelectedId(c.id)}
                  onFocus={() => setSelectedId(c.id)}
                  onClick={() => onOpenProfile(c.id)}
                >
                  <span className="who">
                    <Avatar userId={c.id} name={c.name} hasPhoto={c.avatar} size={30} />
                    <span>{c.name}</span>
                  </span>
                  <span>{c.weekSessions}</span>
                  <span>{fmtTonnes(c.weekVolumeKg)}</span>
                  <span className={deltaClass(c.weekDeltaPct)}>{deltaText(c.weekDeltaPct)}</span>
                  <span>{programText(c)}</span>
                  <span className={c.live ? 'accent' : c.dormantDays !== null ? 'danger' : ''}>
                    {lastSeenText(c, locale, t)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <aside className={`trainer-client-preview${selected.live ? ' live' : ''}`}>
              <div className="trainer-preview-head">
                <Avatar
                  userId={selected.id}
                  name={selected.name}
                  hasPhoto={selected.avatar}
                  size={64}
                />
                <div>
                  <h3>{selected.name}</h3>
                  <p>{clientMeta(selected, locale, t)}</p>
                </div>
                {selected.live && (
                  <span className="tr-live-pill">
                    <span className="live-dot" />
                    {fmtSessionClock(now - (selected.liveStartedAt ?? now))}
                  </span>
                )}
              </div>

              <div className="trainer-preview-stats">
                <div className="cell">
                  <div className="v">{fmtTonnes(selected.weekVolumeKg)}</div>
                  <div className="l">{t.trStat7Days}</div>
                </div>
                <div className="cell">
                  <div className="v">{selected.weekSessions}</div>
                  <div className="l">{t.gymStatSessions}</div>
                </div>
                <div className="cell">
                  <div className={`v${selected.dormantDays === null ? ' ok' : ''}`}>
                    {selected.live
                      ? liveCount
                      : selected.dormantDays === null
                        ? 'ok'
                        : selected.dormantDays}
                  </div>
                  <div className="l">
                    {selected.dormantDays === null
                      ? t.stActive
                      : t.trDormantDays(selected.dormantDays)}
                  </div>
                </div>
              </div>

              {selected.live && (
                <section className="trainer-live-panel">
                  <div className="section-label">{t.trLiveNow}</div>
                  <div className="trainer-live-card">
                    <div className="trainer-live-row">
                      <span>{t.stTrainingNow}</span>
                      <span>
                        {selected.liveSets} · {fmtTonnes(selected.liveVolumeKg)}
                      </span>
                    </div>
                    <div className="trainer-live-grid">
                      <span>#</span>
                      <span>{t.sets}</span>
                      <span>{t.moved}</span>
                      <span>1</span>
                      <span>{selected.liveSets}</span>
                      <span>{fmtTonnes(selected.liveVolumeKg)}</span>
                    </div>
                    <p>{t.trLiveReadOnly}</p>
                  </div>
                </section>
              )}

              <button className="btn btn-secondary" onClick={() => onOpenProfile(selected.id)}>
                <Icon name="list-checks" />
                {t.trAssignProgram}
              </button>
            </aside>
          )}
        </div>
      )}
      {clients !== null && clients.length > 0 && <div className="footnote">{t.trFooterNote}</div>}
    </div>
  );
}

function deltaClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return value > 0 ? 'ok' : 'danger';
}

function deltaText(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '0%';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function programText(c: Client): string {
  if (!c.programName) return 'None';
  return c.programWeek ? `${c.programName} · wk ${c.programWeek}` : c.programName;
}

function lastSeenText(
  c: Client,
  locale: ReturnType<typeof useT>['locale'],
  t: ReturnType<typeof useT>['t'],
): string {
  if (c.live) return 'Now';
  if (c.dormantDays !== null) return t.trDormantDays(c.dormantDays);
  return c.lastSessionAt ? fmtDayMonth(c.lastSessionAt, locale) : t.stNever;
}

function clientMeta(
  c: Client,
  locale: ReturnType<typeof useT>['locale'],
  t: ReturnType<typeof useT>['t'],
): string {
  return c.live
    ? `${c.liveSets} ${t.sets.toLowerCase()} · ${fmtTonnes(c.liveVolumeKg)}`
    : c.dormantDays !== null
      ? t.trDormantDays(c.dormantDays)
      : c.lastSessionAt
        ? `${t.trLastSession(fmtDayMonth(c.lastSessionAt, locale))} · ${fmtTonnes(c.weekVolumeKg)}`
        : t.stNever;
}
