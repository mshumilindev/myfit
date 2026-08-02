/** Admin — design AD-01…AD-06. People table, invites, assignments. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { request, getToken, getUsername, HttpError } from '../api';
import { fmtDayMonth, fmtTonnes, fmtDurationHM, fmtSessionClock, useT } from '../i18n';
import { Dialog, Icon, LanguageSelector, Sheet, Spinner } from '../ui';
import { Avatar } from '../components/Avatar';

interface Person {
  id: string;
  name: string;
  email: string | null;
  role: 'member' | 'trainer' | 'admin';
  status: 'active' | 'invited' | 'suspended';
  trainerId: string | null;
  trainerName: string | null;
  clientCount: number;
  lastSessionAt: number | null;
  live: boolean;
  liveStartedAt: number | null;
  volume30: number;
  avatar: boolean;
  invite: {
    state: 'sent' | 'expired' | 'revoked' | 'claimed';
    expiresAt: number;
    claimedAt: number | null;
    reRequestedAt: number | null;
    token: string;
  } | null;
}

type Filter = 'all' | 'members' | 'trainers' | 'pending';
type Load = 'loading' | 'ready' | 'failed';

const DAY = 24 * 60 * 60 * 1000;

function inviteLink(token: string): string {
  return `${window.location.origin}/#/join/${token}`;
}

export function AdminView() {
  const { t, locale } = useT();
  const [people, setPeople] = useState<Person[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<null | 'member' | 'trainer'>(null);
  const [menuFor, setMenuFor] = useState<Person | null>(null);
  const [assignFor, setAssignFor] = useState<Person | null>(null);
  const [editFor, setEditFor] = useState<Person | null>(null);
  const [deleteFor, setDeleteFor] = useState<Person | null>(null);
  const [detailFor, setDetailFor] = useState<Person | null>(null);
  const [linkFor, setLinkFor] = useState<{
    person: Person;
    token: string;
    expiresAt: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(() => navigator.onLine);

  const refresh = useCallback(() => {
    request<{ people: Person[] }>('GET', '/api/admin/people')
      .then((d) => {
        setPeople(d.people);
        setLoad('ready');
      })
      .catch(() => setLoad((s) => (s === 'loading' ? 'failed' : s)));
  }, []);

  // AC-ADMIN-02: live status updates without manual refresh.
  useEffect(() => {
    refresh();
    const iv = setInterval(() => {
      refresh();
      setNow(Date.now());
    }, 15_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refresh]);

  const trainers = useMemo(() => people.filter((p) => p.role === 'trainer'), [people]);
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      people.filter((p) => {
        if (filter === 'members' && p.role !== 'member') return false;
        if (filter === 'trainers' && p.role !== 'trainer') return false;
        if (filter === 'pending' && p.status !== 'invited') return false;
        if (
          needle &&
          !p.name.toLowerCase().includes(needle) &&
          !(p.email ?? '').toLowerCase().includes(needle)
        )
          return false;
        return true;
      }),
    [people, filter, needle],
  );

  // The signed-in admin is pinned on top as a distinct card (user request);
  // everyone else lives in the AD-01 table below.
  const myName = getUsername();
  const me = people.find((p) => p.name === myName) ?? null;
  const others = filtered.filter((p) => p.id !== me?.id);

  const members = people.filter((p) => p.role === 'member').length;
  const pending = people.filter((p) => p.status === 'invited').length;

  function statusOf(p: Person): { text: string; cls: string } {
    if (p.status === 'suspended') return { text: t.stSuspended, cls: 'muted' };
    if (p.live) return { text: t.stTrainingNow, cls: 'live' };
    if (p.status === 'invited' && p.invite) {
      if (p.invite.state === 'sent')
        return {
          text: t.stInviteSent(Math.max(0, Math.ceil((p.invite.expiresAt - now) / DAY))),
          cls: 'muted',
        };
      if (p.invite.state === 'expired') return { text: t.stInviteExpired, cls: 'danger' };
      if (p.invite.state === 'revoked') return { text: t.stInviteRevoked, cls: 'danger' };
    }
    if (p.lastSessionAt && now - p.lastSessionAt > 30 * DAY)
      return { text: t.stDormant(Math.floor((now - p.lastSessionAt) / DAY)), cls: 'danger' };
    return { text: t.stActive, cls: '' };
  }

  async function act(fn: () => Promise<unknown>): Promise<void> {
    // AC-ADMIN-12: refuse rather than queue when offline.
    if (!navigator.onLine) return;
    try {
      await fn();
      refresh();
    } catch {
      refresh();
    }
  }

  return (
    <div className="screen admin">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="kicker">{t.roleAdmin}</div>
          <h1 className="title-26">{t.adminPeople}</h1>
          <div className="sub">{t.adminSummary(members, trainers.length, pending)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setCreating('trainer')}>
            {t.adminNewTrainer}
          </button>
          <button className="btn btn-primary" onClick={() => setCreating('member')}>
            <Icon name="plus" /> {t.adminNewMember}
          </button>
          <LanguageSelector />
        </div>
      </div>

      {!online && (
        <div className="banner danger-ring">
          <Icon name="cloud-slash" />
          <span>{t.adminOffline}</span>
        </div>
      )}

      <div className="admin-toolbar">
        <div className="searchbar sm">
          <Icon name="magnifying-glass" />
          <input value={q} placeholder={t.adminSearch} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {(
            [
              ['all', t.adminFilterAll],
              ['members', t.adminFilterMembers],
              ['trainers', t.adminFilterTrainers],
              ['pending', t.adminFilterPending],
            ] as Array<[Filter, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              className={`seg-opt${filter === id ? ' active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {load === 'loading' &&
        [0, 1, 2].map((i) => (
          <div key={i} className="admin-row skeleton">
            <div className="sk" style={{ width: 34, height: 34, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="sk" style={{ width: '40%', height: 12, marginBottom: 6 }} />
              <div className="sk" style={{ width: '60%', height: 9 }} />
            </div>
          </div>
        ))}

      {load === 'failed' && (
        <div className="empty">
          <Icon name="warning-circle" />
          <div className="t">{t.error}</div>
          <button className="btn btn-secondary" onClick={() => refresh()}>
            {t.retry}
          </button>
        </div>
      )}

      {load === 'ready' && people.length <= 1 && (
        <div className="empty">
          <Icon name="map-pin" />
          <div className="t">{t.adminEmptyTitle}</div>
          <div className="s">{t.adminEmptyBody}</div>
          <button className="btn btn-primary" onClick={() => setCreating('member')}>
            <Icon name="plus" /> {t.adminNewMember}
          </button>
        </div>
      )}

      {load === 'ready' && me && (
        <div className="admin-me-card" role="button" tabIndex={0} onClick={() => setDetailFor(me)}>
          <Avatar userId={me.id} name={me.name} hasPhoto={me.avatar} size={40} />
          <div className="who">
            <div className="n">
              {me.name} <span className="tag tag-accent">{t.adminYou}</span>
            </div>
            <div className="e">{me.email}</div>
          </div>
          <span className="tag tag-accent">{t.roleAdmin}</span>
          <div className="meta vol">{me.volume30 > 0 ? fmtTonnes(me.volume30) : '—'}</div>
          <div className={`meta status ${statusOf(me).cls}`}>
            {me.live && <span className="live-dot" />}
            {statusOf(me).text}
          </div>
        </div>
      )}

      {load === 'ready' && others.length > 0 && (
        <div className="admin-table">
          <div className="admin-thead">
            <span>{t.adminColPerson}</span>
            <span>{t.adminColRole}</span>
            <span>{t.adminColTrainer}</span>
            <span>{t.adminColLast}</span>
            <span>{t.adminColVol}</span>
            <span>{t.adminColStatus}</span>
            <span />
          </div>
          {others.map((p) => {
            const st = statusOf(p);
            return (
              <div
                key={p.id}
                className="admin-row"
                role="button"
                tabIndex={0}
                onClick={() => setDetailFor(p)}
              >
                <div className="who">
                  <Avatar userId={p.id} name={p.name} hasPhoto={p.avatar} size={34} />
                  <div>
                    <div className="n">{p.name}</div>
                    <div className="e">{p.email}</div>
                    {p.invite?.reRequestedAt && p.status === 'invited' && (
                      <div className="rerequest">
                        {t.adminAskedNewLink(fmtDayMonth(p.invite.reRequestedAt, locale))}{' '}
                        <button
                          className="linklike"
                          onClick={(e) => {
                            e.stopPropagation();
                            void act(async () => {
                              const r = await request<{
                                invite: { token: string; expires_at: number };
                              }>('POST', `/api/admin/users/${p.id}/invite`);
                              setLinkFor({
                                person: p,
                                token: r.invite.token,
                                expiresAt: r.invite.expires_at,
                              });
                            });
                          }}
                        >
                          {t.adminSend}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <span>
                  <span className={`tag ${p.role === 'trainer' ? 'tag-accent' : 'tag-neutral'}`}>
                    {p.role === 'trainer'
                      ? t.roleTrainer
                      : p.role === 'admin'
                        ? t.roleAdmin
                        : t.roleMember}
                  </span>
                </span>
                <div className="meta">
                  {p.role === 'trainer' ? t.adminClients(p.clientCount) : (p.trainerName ?? '—')}
                </div>
                <div className="meta">
                  {p.live
                    ? t.stTrainingNow
                    : p.lastSessionAt
                      ? fmtDayMonth(p.lastSessionAt, locale)
                      : t.stNever}
                </div>
                <div className="meta vol">{p.volume30 > 0 ? fmtTonnes(p.volume30) : '—'}</div>
                <div className={`meta status ${st.cls}`}>
                  <span className={`st-dot ${st.cls}`} />
                  {st.text}
                  {p.live && p.liveStartedAt ? ` · ${fmtSessionClock(now - p.liveStartedAt)}` : ''}
                </div>
                <button
                  className="dots"
                  aria-label="Menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(p);
                  }}
                >
                  <Icon name="dots-three-vertical" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {load === 'ready' && (
        <div className="admin-foot-note">
          <Icon name="shield-check" />
          <span>{t.adminOnlyNote}</span>
        </div>
      )}

      {creating && (
        <NewPersonDialog
          kind={creating}
          trainers={trainers}
          onClose={() => setCreating(null)}
          onCreated={(p, token, expiresAt) => {
            setCreating(null);
            refresh();
            setLinkFor({ person: p, token, expiresAt });
          }}
        />
      )}

      {linkFor && (
        <LinkDialog
          person={linkFor.person}
          token={linkFor.token}
          expiresAt={linkFor.expiresAt}
          onClose={() => setLinkFor(null)}
        />
      )}

      {menuFor && (
        <Sheet padded={false} onClose={() => setMenuFor(null)}>
          <div className="sheet-label">{menuFor.name}</div>
          <button
            className="menu-item"
            onClick={() => {
              setDetailFor(menuFor);
              setMenuFor(null);
            }}
          >
            <Icon name="arrow-up-right" /> {t.adminOpenProfile}
          </button>
          {menuFor.role === 'member' && (
            <button
              className="menu-item"
              onClick={() => {
                setAssignFor(menuFor);
                setMenuFor(null);
              }}
            >
              <Icon name="arrows-clockwise" /> {t.adminChangeTrainer}
            </button>
          )}
          <button
            className="menu-item"
            onClick={() => {
              setEditFor(menuFor);
              setMenuFor(null);
            }}
          >
            <Icon name="pencil-simple" /> {t.adminEditNameEmail}
          </button>
          {menuFor.status !== 'invited' && (
            <button
              className="menu-item"
              onClick={() => {
                const p = menuFor;
                setMenuFor(null);
                void act(async () => {
                  const r = await request<{ invite: { token: string; expires_at: number } }>(
                    'POST',
                    `/api/admin/users/${p.id}/reset`,
                  );
                  setLinkFor({ person: p, token: r.invite.token, expiresAt: r.invite.expires_at });
                });
              }}
            >
              <Icon name="arrow-clockwise" /> {t.adminSendReset}
            </button>
          )}
          {menuFor.status === 'invited' && menuFor.invite && (
            <>
              <button
                className="menu-item"
                onClick={() => {
                  const p = menuFor;
                  setMenuFor(null);
                  void act(async () => {
                    const r = await request<{ invite: { token: string; expires_at: number } }>(
                      'POST',
                      `/api/admin/users/${p.id}/invite`,
                    );
                    setLinkFor({
                      person: p,
                      token: r.invite.token,
                      expiresAt: r.invite.expires_at,
                    });
                  });
                }}
              >
                <Icon name="arrow-clockwise" /> {t.adminNewLink}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  const p = menuFor;
                  setMenuFor(null);
                  void act(() => request('POST', `/api/admin/invites/${p.invite!.token}/revoke`));
                }}
              >
                <Icon name="eraser" /> {t.adminRevoke}
              </button>
            </>
          )}
          <button
            className="menu-item"
            onClick={() => {
              const p = menuFor;
              setMenuFor(null);
              void (async () => {
                const res = await fetch(`/api/admin/users/${p.id}/export`, {
                  headers: { Authorization: `Bearer ${getToken() ?? ''}` },
                });
                const blob = await res.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `myfit-${p.name}.json`;
                a.click();
              })();
            }}
          >
            <Icon name="copy" /> {t.adminExportData}
          </button>
          <div className="sheet-rule" />
          <button
            className="menu-item danger"
            onClick={() => {
              const p = menuFor;
              setMenuFor(null);
              void act(() =>
                request(
                  'POST',
                  `/api/admin/users/${p.id}/${p.status === 'suspended' ? 'unsuspend' : 'suspend'}`,
                ),
              );
            }}
          >
            <Icon name="cloud-slash" />
            {menuFor.status === 'suspended' ? t.adminUnsuspend : t.adminSuspend}
          </button>
          <button
            className="menu-item danger"
            onClick={() => {
              setDeleteFor(menuFor);
              setMenuFor(null);
            }}
          >
            <Icon name="trash" /> {t.adminDeleteMember}
          </button>
        </Sheet>
      )}

      {assignFor && (
        <AssignTrainerDialog
          person={assignFor}
          trainers={trainers}
          onClose={() => setAssignFor(null)}
          onDone={() => {
            setAssignFor(null);
            refresh();
          }}
        />
      )}

      {editFor && (
        <EditDialog
          person={editFor}
          onClose={() => setEditFor(null)}
          onDone={() => {
            setEditFor(null);
            refresh();
          }}
        />
      )}

      {deleteFor && (
        <DeleteDialog
          person={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDone={() => {
            setDeleteFor(null);
            refresh();
          }}
        />
      )}

      {detailFor && (
        <MemberDetailSheet person={detailFor} now={now} onClose={() => setDetailFor(null)} />
      )}
    </div>
  );
}

// --- New member / trainer (AD-02) -------------------------------------------

function NewPersonDialog(props: {
  kind: 'member' | 'trainer';
  trainers: Person[];
  onClose: () => void;
  onCreated: (p: Person, token: string, expiresAt: number) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{props.kind === 'member' ? t.adminNewMember : t.adminNewTrainer}</span>
      </div>
      <input
        className="input"
        placeholder={t.username}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={`input${error ? ' error' : ''}`}
        type="email"
        placeholder={t.email}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {props.kind === 'member' && props.trainers.length > 0 && (
        <div className="assign-list">
          <div className="field-label">{t.adminAssignedTrainer}</div>
          <button
            className={`gym-pick-row${trainerId === null ? ' suggested' : ''}`}
            onClick={() => setTrainerId(null)}
          >
            <span className="body">
              <span className="n">{t.adminNoTrainer}</span>
              <span className="s">{t.adminNoTrainerNote}</span>
            </span>
          </button>
          {props.trainers.map((tr) => (
            <button
              key={tr.id}
              className={`gym-pick-row${trainerId === tr.id ? ' suggested' : ''}`}
              onClick={() => setTrainerId(tr.id)}
            >
              <Avatar userId={tr.id} name={tr.name} hasPhoto={tr.avatar} size={34} />
              <span className="body">
                <span className="n">{tr.name}</span>
                <span className="s">{t.adminClients(tr.clientCount)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {error}
        </div>
      )}
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          disabled={busy || name.trim().length < 2 || !email.includes('@')}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await request<{
                person: Person;
                invite: { token: string; expires_at: number };
              }>('POST', '/api/admin/users', {
                name: name.trim(),
                email: email.trim(),
                trainerId,
                role: props.kind,
              });
              props.onCreated(r.person, r.invite.token, r.invite.expires_at);
            } catch (e) {
              if (e instanceof HttpError && e.status === 409) {
                const holder = /belongs|taken/.test(e.message) ? e.message : '';
                setError(`${t.adminEmailTaken(holder || '…')} 409 · POST /api/admin/users`);
              } else setError(e instanceof Error ? e.message : t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner onAccent />} {t.save}
        </button>
      </div>
    </Sheet>
  );
}

/** AD-02: link + QR in the same dialog the account was created in. */
function LinkDialog(props: {
  person: Person;
  token: string;
  expiresAt: number;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const url = inviteLink(props.token);
  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t" style={{ color: 'var(--color-ok)' }}>
          <Icon name="check-circle" weight="fill" /> {t.adminCreated}
        </span>
      </div>
      <div className="h1">{t.adminReadyToClaim(props.person.name)}</div>
      <p className="detail-muted">{t.adminSendLink}</p>
      <div className="field-label">{t.adminInviteLink}</div>
      <div className="invite-link-line">
        <div className="invite-link-row">
          <Icon name="arrow-up-right" />
          <code>{url.replace(/^https?:\/\//, '')}</code>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          <Icon name="copy" /> {copied ? t.adminCopied : t.adminCopy}
        </button>
        <button className="btn btn-secondary" onClick={() => setShowQr((x) => !x)}>
          {t.adminQr}
        </button>
      </div>
      {showQr && (
        <img
          className="invite-qr"
          alt="QR"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=1f2125&color=e9eaec&data=${encodeURIComponent(url)}`}
        />
      )}
      <div className="invite-cells">
        <div className="cell">
          <div className="l">{t.adminExpiresLabel}</div>
          <div className="v">{t.adminExpires(fmtDayMonth(props.expiresAt, locale))}</div>
        </div>
        <div className="cell">
          <div className="l">{t.adminUsesLabel}</div>
          <div className="v">{t.adminSingleUse}</div>
        </div>
        <div className="cell">
          <div className="l">{t.adminAssignedTrainer}</div>
          <div className="v">{props.person.trainerName ?? t.adminNoTrainer}</div>
        </div>
      </div>
      <div className="info-row">
        <Icon name="info" />
        <span>{t.adminLinkNote}</span>
      </div>
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.adminCreateAnother}
        </button>
        <button className="btn btn-primary grow" onClick={props.onClose}>
          {t.adminDone}
        </button>
      </div>
    </Sheet>
  );
}

// --- Assign trainer (AD-04) --------------------------------------------------

function AssignTrainerDialog(props: {
  person: Person;
  trainers: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const [sel, setSel] = useState<string | null>(props.person.trainerId);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.adminWhoTrains(props.person.name)}</span>
      </div>
      <p className="detail-muted">{t.adminTrainerNote}</p>
      <div className="assign-list">
        {props.trainers.map((tr) => (
          <button
            key={tr.id}
            className={`gym-pick-row${sel === tr.id ? ' suggested' : ''}`}
            onClick={() => setSel(tr.id)}
          >
            <Avatar userId={tr.id} name={tr.name} hasPhoto={tr.avatar} size={34} />
            <span className="body">
              <span className="n">{tr.name}</span>
              <span className="s">{t.adminClients(tr.clientCount)}</span>
            </span>
          </button>
        ))}
        <button
          className={`gym-pick-row${sel === null ? ' suggested' : ''}`}
          onClick={() => setSel(null)}
        >
          <span className="body">
            <span className="n">{t.adminNoTrainer}</span>
            <span className="s">{t.adminNoTrainerNote}</span>
          </span>
        </button>
      </div>
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await request('POST', `/api/admin/users/${props.person.id}/trainer`, {
                trainerId: sel,
              });
              props.onDone();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner onAccent />} {t.adminAssign}
        </button>
      </div>
    </Sheet>
  );
}

// --- Edit name & email -------------------------------------------------------

function EditDialog(props: { person: Person; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [name, setName] = useState(props.person.name);
  const [email, setEmail] = useState(props.person.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.adminEditNameEmail}</span>
      </div>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className="input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {error}
        </div>
      )}
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await request('PUT', `/api/admin/users/${props.person.id}`, { name, email });
              props.onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner onAccent />} {t.save}
        </button>
      </div>
    </Sheet>
  );
}

// --- Delete with typed name (AD-05, AC-ADMIN-10) -----------------------------

function DeleteDialog(props: { person: Person; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const p = props.person;
  return (
    <Dialog
      danger
      title={t.adminDeleteTitle(p.name)}
      onClose={props.onClose}
      actions={
        <>
          <button className="btn btn-secondary" onClick={props.onClose}>
            {t.keep}
          </button>
          <button
            className="danger-outline"
            disabled={typed !== p.name || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request('DELETE', `/api/admin/users/${p.id}`);
                props.onDone();
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.delete}
          </button>
        </>
      }
    >
      {t.adminDeleteBody(0, fmtTonnes(p.volume30), p.trainerName ?? '')}
      <input
        className="input"
        style={{ marginTop: 12 }}
        placeholder={t.adminDeleteType(p.name)}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
    </Dialog>
  );
}

// --- Member detail (AD-03, shared shape with trainer view) -------------------

export interface DetailData {
  person: Person;
  volume30: number;
  sessions30: number;
  perWeek: number;
  sessions: Array<{
    id: string;
    startedAt: number;
    finishedAt: number | null;
    live: boolean;
    sets: number;
    volumeKg: number;
    gymName: string | null;
  }>;
  notes: Array<{ id: string; text: string; createdAt: number; trainerName: string }>;
}

export function MemberDetailSheet({
  person,
  now,
  onClose,
  trainerMode = false,
  onAddNote,
}: {
  person: Person | { id: string; name: string; avatar: boolean };
  now: number;
  onClose: () => void;
  trainerMode?: boolean;
  onAddNote?: (text: string) => Promise<void>;
}) {
  const { t, locale } = useT();
  const [data, setData] = useState<DetailData | null | 'denied'>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const url = trainerMode
      ? `/api/trainer/clients/${person.id}`
      : `/api/admin/users/${person.id}/detail`;
    request<DetailData>('GET', url)
      .then(setData)
      .catch((e) => {
        if (e instanceof HttpError && e.status === 403) setData('denied');
      });
  }, [person.id, trainerMode]);

  const live = data !== null && data !== 'denied' ? data.sessions.find((s) => s.live) : undefined;

  return (
    <Sheet onClose={onClose}>
      {trainerMode && (
        <div className="tr-readonly-bar">
          <Icon name="shield-check" /> {t.trReadOnly(person.name)}
        </div>
      )}
      <div className="detail-head">
        <Avatar userId={person.id} name={person.name} hasPhoto={person.avatar} size={40} />
        <div>
          <div className="h1">
            {person.name}
            {live && (
              <span className="live-chip">
                <span className="live-dot" /> {t.stTrainingNow} ·{' '}
                {fmtSessionClock(now - live.startedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
      {data === null && <Spinner size={18} />}
      {data === 'denied' && (
        <div className="empty">
          <Icon name="warning-circle" />
          <div className="t">{t.trLostAccess(person.name)}</div>
          <div className="s">403 · GET /api/trainer/clients</div>
        </div>
      )}
      {data !== null && data !== 'denied' && (
        <>
          <div className="stat-grid">
            <div className="cell">
              <div className="v">{fmtTonnes(data.volume30)}</div>
              <div className="l">{t.adminVol30}</div>
            </div>
            <div className="cell">
              <div className="v">{data.sessions30}</div>
              <div className="l">{t.adminSessions}</div>
            </div>
            <div className="cell">
              <div className="v">{data.perWeek}</div>
              <div className="l">{t.adminPerWeek}</div>
            </div>
          </div>
          <div className="field-label">{t.adminRecent}</div>
          <div className="detail-sessions">
            {data.sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="row">
                <span>{fmtDayMonth(s.startedAt, locale)}</span>
                <span>{s.gymName ?? '—'}</span>
                <span>
                  {s.sets} · {fmtTonnes(s.volumeKg)}
                </span>
                <span>
                  {s.live ? (
                    <span className="live-chip">
                      <span className="live-dot" />
                    </span>
                  ) : s.finishedAt ? (
                    fmtDurationHM(s.finishedAt - s.startedAt)
                  ) : (
                    ''
                  )}
                </span>
              </div>
            ))}
          </div>
          {(data.notes.length > 0 || trainerMode) && (
            <>
              <div className="field-label">{t.trNotes}</div>
              {data.notes.map((n) => (
                <div key={n.id} className="tr-note">
                  <div>{n.text}</div>
                  <div className="m">
                    {fmtDayMonth(n.createdAt, locale)} · {t.trNotePrivate}
                  </div>
                </div>
              ))}
              {trainerMode && onAddNote && (
                <div className="tr-note-add">
                  <input
                    className="input"
                    placeholder={t.trAddNote}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    className="btn btn-secondary"
                    disabled={!note.trim()}
                    onClick={async () => {
                      await onAddNote(note.trim());
                      setNote('');
                      const url = `/api/trainer/clients/${person.id}`;
                      request<DetailData>('GET', url)
                        .then(setData)
                        .catch(() => {});
                    }}
                  >
                    {t.save}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
