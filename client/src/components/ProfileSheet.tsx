/** Own profile — design O-10: avatar, who can see my data, access log. */
import { useEffect, useState } from 'react';
import { request } from '../api';
import { fmtDayMonth, useT } from '../i18n';
import { Icon, Sheet, Spinner } from '../ui';
import { Avatar } from './Avatar';

interface Me {
  id: string;
  name: string;
  email: string | null;
  role: 'member' | 'trainer' | 'admin';
  avatar: boolean;
  access: Array<{ id: string; name: string; role: 'admin' | 'trainer' }>;
}

export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [audit, setAudit] = useState<Array<{
    at: number;
    resource: string;
    readerName: string | null;
  }> | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    request<Me>('GET', '/api/profile/me')
      .then(setMe)
      .catch(() => {});
  }, []);

  const roleLabel = (r: string) =>
    r === 'admin' ? t.roleAdmin : r === 'trainer' ? t.roleTrainer : t.roleMember;

  return (
    <Sheet onClose={onClose}>
      {me === null ? (
        <Spinner size={18} />
      ) : (
        <>
          <div className="detail-head">
            <Avatar userId={me.id} name={me.name} hasPhoto={me.avatar} size={76} />
            <div>
              <div className="h1">{me.name}</div>
              <div className="detail-muted">
                {me.email} · {roleLabel(me.role)}
              </div>
            </div>
          </div>

          <div className="field-label">{t.profWhoSees}</div>
          {me.access.length === 0 ? (
            <div className="detail-muted">{t.profNoAccess}</div>
          ) : (
            <>
              {me.access.map((a) => (
                <div key={a.id} className="access-row">
                  <Avatar name={a.name} size={34} />
                  <span className="n">{a.name}</span>
                  <span className="s">
                    {roleLabel(a.role)} · {a.role === 'admin' ? t.profFullAccess : t.profReads}
                  </span>
                </div>
              ))}
              <p className="footnote">{t.profOnlyThese}</p>
            </>
          )}

          <button
            className="hours-toggle"
            onClick={() => {
              setShowAudit((x) => !x);
              if (audit === null)
                request<{
                  reads: Array<{ at: number; resource: string; readerName: string | null }>;
                }>('GET', '/api/profile/me/audit')
                  .then((d) => setAudit(d.reads))
                  .catch(() => setAudit([]));
            }}
          >
            {t.profAudit} <Icon name={showAudit ? 'caret-left' : 'arrow-right'} />
          </button>
          {showAudit &&
            (audit === null ? (
              <Spinner size={14} />
            ) : audit.length === 0 ? (
              <div className="detail-muted">{t.profAuditEmpty}</div>
            ) : (
              <div className="detail-sessions">
                {audit.slice(0, 30).map((r, i) => (
                  <div key={i} className="row">
                    <span>{fmtDayMonth(r.at, locale)}</span>
                    <span>{r.readerName ?? '—'}</span>
                    <span>{r.resource}</span>
                  </div>
                ))}
              </div>
            ))}
        </>
      )}
    </Sheet>
  );
}
