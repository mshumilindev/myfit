/** Full user profile page: direct-link safe, data-rich, role-aware. */
import { useEffect, useState, type ReactNode } from 'react';
import { HttpError, request, setUsername } from '../api';
import { fmtDayMonth, fmtDurationHM, fmtTonnes, useT } from '../i18n';
import { Icon, Spinner } from '../ui';
import { Avatar } from '../components/Avatar';
import { AvatarUploader } from '../components/AvatarUploader';
import { GymThumb } from '../components/GymThumb';
import type { Shell } from '../App';

interface ProfileData {
  viewer: { id: string; relation: 'self' | 'admin' | 'trainer'; role: string };
  person: {
    id: string;
    name: string;
    username: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    role: 'member' | 'trainer' | 'admin';
    status: 'active' | 'invited' | 'suspended';
    joinedAt: number;
    trainerName: string | null;
    clientCount: number;
    avatar: boolean;
  };
  access: Array<{ id: string; name: string; role: 'admin' | 'trainer' }>;
  summary: {
    sessions: number;
    sessions30: number;
    perWeek30: number;
    liveSessions: number;
    firstSessionAt: number | null;
    lastSessionAt: number | null;
    durationMs: number;
    sets: number;
    exercises: number;
    volumeKg: number;
    cardioMinutes: number;
    volume30: number;
    volume7: number;
  };
  sessions: Array<{
    id: string;
    startedAt: number;
    finishedAt: number | null;
    autoFinished: boolean;
    live: boolean;
    durationMs: number | null;
    gymName: string | null;
    sets: number;
    exercises: number;
    volumeKg: number;
    exerciseNames: string[];
  }>;
  gyms: Array<{
    id: string;
    name: string;
    favorite: number;
    lat: number;
    lng: number;
    radiusM: number;
    sessions: number;
    lastSessionAt: number | null;
    volumeKg: number;
  }>;
  topExercises: Array<{
    name: string;
    sets: number;
    sessions: number;
    lastAt: number;
    volumeKg: number;
    bestE1rm: number;
  }>;
  notes: Array<{ id: string; text: string; createdAt: number; trainerName: string }>;
  audit: Array<{ at: number; resource: string; readerName: string | null; readerRole: string }>;
}

type Load = ProfileData | 'loading' | 'denied' | 'missing' | 'failed';

export function ProfileView({
  userId,
  shell,
  onClose,
}: {
  userId: string;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [loaded, setLoaded] = useState<{ userId: string; value: Load }>(() => ({
    userId,
    value: 'loading',
  }));
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [trainerNote, setTrainerNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [avatarRefresh, setAvatarRefresh] = useState(0);
  const load = loaded.userId === userId ? loaded.value : 'loading';
  const isSelf = typeof load === 'object' && load.viewer.relation === 'self';
  const canEditDetails =
    typeof load === 'object' &&
    (load.viewer.relation === 'self' || load.viewer.relation === 'admin');

  useEffect(() => {
    let alive = true;
    request<ProfileData>('GET', `/api/profile/users/${encodeURIComponent(userId)}`)
      .then((data) => {
        if (alive) setLoaded({ userId, value: data });
        if (alive && (data.viewer.relation === 'self' || data.viewer.relation === 'admin')) {
          setEditFirstName(data.person.firstName);
          setEditLastName(data.person.lastName ?? '');
          setEditUsername(data.person.username);
        }
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof HttpError && e.status === 403) setLoaded({ userId, value: 'denied' });
        else if (e instanceof HttpError && e.status === 404)
          setLoaded({ userId, value: 'missing' });
        else setLoaded({ userId, value: 'failed' });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  function resetProfileFields(data: ProfileData) {
    setEditFirstName(data.person.firstName);
    setEditLastName(data.person.lastName ?? '');
    setEditUsername(data.person.username);
    setProfileError(null);
  }

  async function saveProfile() {
    if (typeof load !== 'object') return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      let next: ProfileData;
      if (load.viewer.relation === 'self') {
        next = await request<ProfileData>('PUT', '/api/profile/me', {
          firstName: editFirstName,
          lastName: editLastName,
          username: editUsername,
        });
        setUsername(next.person.name);
      } else {
        await request('PUT', `/api/admin/users/${encodeURIComponent(load.person.id)}`, {
          firstName: editFirstName,
          lastName: editLastName,
          username: editUsername,
        });
        next = await request<ProfileData>(
          'GET',
          `/api/profile/users/${encodeURIComponent(load.person.id)}`,
        );
      }
      setEditFirstName(next.person.firstName);
      setEditLastName(next.person.lastName ?? '');
      setEditUsername(next.person.username);
      setLoaded({ userId, value: next });
      shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileSaved });
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : t.error);
    } finally {
      setSavingProfile(false);
    }
  }

  function avatarUploaded() {
    if (typeof load !== 'object') return;
    setLoaded({
      userId,
      value: { ...load, person: { ...load.person, avatar: true } },
    });
    setAvatarRefresh((n) => n + 1);
    shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileAvatarUpdated });
  }

  async function removeAvatar() {
    if (typeof load !== 'object') return;
    await request('DELETE', '/api/profile/me/avatar');
    setLoaded({
      userId,
      value: { ...load, person: { ...load.person, avatar: false } },
    });
    setAvatarRefresh((n) => n + 1);
    shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileAvatarRemoved });
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordError(t.profilePasswordMismatch);
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await request('PUT', '/api/profile/me/password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profilePasswordSaved });
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : t.error);
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveTrainerNote() {
    if (typeof load !== 'object' || load.viewer.relation !== 'trainer') return;
    const text = trainerNote.trim();
    if (!text) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      await request('POST', `/api/trainer/clients/${load.person.id}/notes`, { text });
      const next = await request<ProfileData>(
        'GET',
        `/api/profile/users/${encodeURIComponent(userId)}`,
      );
      setLoaded({ userId, value: next });
      setTrainerNote('');
      shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileNoteSaved });
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : t.error);
    } finally {
      setSavingNote(false);
    }
  }

  const roleLabel = (role: string) =>
    role === 'admin' ? t.roleAdmin : role === 'trainer' ? t.roleTrainer : t.roleMember;
  const statusLabel = (status: string) =>
    status === 'suspended'
      ? t.stSuspended
      : status === 'invited'
        ? t.adminFilterPending
        : t.stActive;
  const profileDirty =
    typeof load === 'object' &&
    canEditDetails &&
    (editFirstName !== load.person.firstName ||
      editLastName !== (load.person.lastName ?? '') ||
      editUsername !== load.person.username);
  const passwordReady =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    !savingPassword;

  return (
    <div className="screen profile-page">
      <div className="profile-top">
        <button className="profile-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <div>
          <div className="kicker">{t.profileTitle}</div>
          <h1 className="title-26">{load === 'loading' ? t.profileTitle : profileName(load, t)}</h1>
        </div>
      </div>

      {load === 'loading' && <Spinner size={18} />}
      {(load === 'denied' || load === 'missing' || load === 'failed') && (
        <div className="empty">
          <Icon name="warning-circle" />
          <div className="t">
            {load === 'denied'
              ? t.profileAccessDenied
              : load === 'missing'
                ? t.profileMissing
                : t.error}
          </div>
          <div className="s">
            {load === 'denied' ? t.profileAccessDeniedBody : `GET /api/profile/users/${userId}`}
          </div>
        </div>
      )}

      {typeof load === 'object' && (
        <>
          <section className="profile-hero">
            {isSelf ? (
              <AvatarUploader
                userId={load.person.id}
                name={load.person.name}
                hasPhoto={load.person.avatar}
                refreshKey={avatarRefresh}
                compact
                onUploaded={avatarUploaded}
                onRemoved={removeAvatar}
              />
            ) : (
              <Avatar
                userId={load.person.id}
                name={load.person.name}
                hasPhoto={load.person.avatar}
                size={82}
                refreshKey={avatarRefresh}
              />
            )}
            <div className="profile-identity">
              <div className="profile-name-line">
                <span>{load.person.name}</span>
                <span className="tag tag-accent">
                  {load.viewer.relation === 'self' ? t.profileSelf : roleLabel(load.person.role)}
                </span>
              </div>
              {canEditDetails ? (
                <div className="profile-detail-fields" aria-label={t.profileEditTitle}>
                  <label className="input-field">
                    <span>{t.firstName}</span>
                    <input
                      className="input"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.currentTarget.value)}
                      autoComplete="given-name"
                    />
                  </label>
                  <label className="input-field">
                    <span>{t.lastName}</span>
                    <input
                      className="input"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.currentTarget.value)}
                      autoComplete="family-name"
                    />
                  </label>
                  <label className="input-field">
                    <span>{t.username}</span>
                    <input
                      className="input"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.currentTarget.value)}
                      autoComplete="username"
                    />
                  </label>
                  <div className="profile-edit-actions inline">
                    <button
                      className="btn btn-secondary"
                      onClick={() => resetProfileFields(load)}
                      disabled={savingProfile || !profileDirty}
                    >
                      {t.cancel}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={saveProfile}
                      disabled={
                        savingProfile ||
                        !profileDirty ||
                        editFirstName.trim().length < 2 ||
                        editUsername.trim().length < 2
                      }
                    >
                      {t.save}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="detail-muted">
                  @{load.person.username}
                  {load.person.email ? ` · ${load.person.email}` : ''}
                </div>
              )}
              <div className="profile-meta-grid">
                <span>
                  {t.profileJoined}: {fmtDayMonth(load.person.joinedAt, locale)}
                </span>
                <span>
                  {t.profileStatus}: {statusLabel(load.person.status)}
                </span>
                <span>
                  {t.profileTrainer}: {load.person.trainerName ?? '—'}
                </span>
                {load.person.clientCount > 0 && (
                  <span>
                    {t.profileClientCount}: {load.person.clientCount}
                  </span>
                )}
                {load.summary.firstSessionAt && (
                  <span>
                    {t.profileFirstSession}: {fmtDayMonth(load.summary.firstSessionAt, locale)}
                  </span>
                )}
                {load.summary.lastSessionAt && (
                  <span>
                    {t.profileLastSession}: {fmtDayMonth(load.summary.lastSessionAt, locale)}
                  </span>
                )}
              </div>
            </div>
          </section>

          {profileError && (
            <div className="error-card profile-error">
              <Icon name="warning-circle" />
              <span>{profileError}</span>
            </div>
          )}

          {isSelf && (
            <section className="profile-section profile-security">
              <div>
                <div className="profile-stat-heading">
                  <Icon name="shield-check" />
                  <span>{t.profileSecurity}</span>
                </div>
                <div className="detail-muted">{t.profilePasswordBody}</div>
              </div>
              <div className="profile-password-fields">
                <label className="input-field">
                  <span>{t.profilePasswordCurrent}</span>
                  <input
                    className="input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                    autoComplete="current-password"
                  />
                </label>
                <label className="input-field">
                  <span>{t.profilePasswordNew}</span>
                  <input
                    className="input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.currentTarget.value)}
                    autoComplete="new-password"
                  />
                </label>
                <label className="input-field">
                  <span>{t.profilePasswordConfirm}</span>
                  <input
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                    autoComplete="new-password"
                  />
                </label>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                  }}
                  disabled={
                    savingPassword || (!currentPassword && !newPassword && !confirmPassword)
                  }
                >
                  {t.cancel}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={savePassword}
                  disabled={!passwordReady}
                >
                  {t.profilePasswordSave}
                </button>
              </div>
              {passwordError && (
                <div className="field-error">
                  <Icon name="warning-circle" />
                  {passwordError}
                </div>
              )}
            </section>
          )}

          <p className="profile-privacy-note">
            <Icon name="shield-check" />
            {t.profileDirectPrivateNote}
          </p>

          <section className="profile-stats">
            <StatGroup title={t.profileStatsActivity} icon="calendar-blank">
              <Stat
                icon="calendar-blank"
                value={String(load.summary.sessions)}
                label={t.adminSessions}
              />
              <Stat
                icon="chart-line-up"
                value={String(load.summary.sessions30)}
                label={t.profileSessions30}
              />
              <Stat
                icon="arrows-clockwise"
                value={String(load.summary.perWeek30)}
                label={t.adminPerWeek}
              />
              {load.summary.liveSessions > 0 && (
                <Stat
                  icon="play"
                  value={String(load.summary.liveSessions)}
                  label={t.profileLive}
                  accent
                />
              )}
            </StatGroup>

            <StatGroup title={t.profileStatsLoad} icon="flame">
              <Stat
                icon="trophy"
                value={fmtTonnes(load.summary.volumeKg)}
                label={t.profileLifetime}
              />
              <Stat
                icon="chart-line"
                value={fmtTonnes(load.summary.volume30)}
                label={t.adminVol30}
              />
              <Stat icon="flame" value={fmtTonnes(load.summary.volume7)} label={t.profileWeek} />
            </StatGroup>

            <StatGroup title={t.profileStatsStructure} icon="barbell">
              <Stat icon="list-plus" value={String(load.summary.sets)} label={t.setsStat} />
              <Stat icon="barbell" value={String(load.summary.exercises)} label={t.exercises} />
              <Stat
                icon="timer"
                value={fmtDurationHM(load.summary.durationMs)}
                label={t.duration}
              />
              <Stat
                icon="clock"
                value={String(Math.round(load.summary.cardioMinutes))}
                label={t.cardioMinutes}
              />
            </StatGroup>
          </section>

          <section className="profile-section">
            <div className="field-label">{t.profWhoSees}</div>
            {load.access.length === 0 ? (
              <div className="detail-muted">{t.profNoAccess}</div>
            ) : (
              load.access.map((a) => (
                <div key={a.id} className="access-row">
                  <Avatar userId={a.id} name={a.name} size={34} />
                  <span className="n">{a.name}</span>
                  <span className="s">
                    {roleLabel(a.role)} · {a.role === 'admin' ? t.profFullAccess : t.profReads}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="profile-columns">
            <div className="profile-section">
              <div className="field-label">{t.profileTopExercises}</div>
              {load.topExercises.length === 0 ? (
                <div className="detail-muted">{t.profileNoTraining}</div>
              ) : (
                <div className="profile-list">
                  {load.topExercises.map((ex) => (
                    <div key={ex.name} className="profile-row">
                      <span>
                        <span className="n">{ex.name}</span>
                        <span className="s">
                          {ex.sessions} · {ex.sets} {t.sets}
                        </span>
                      </span>
                      <span>
                        <span className="n">{fmtTonnes(ex.volumeKg)}</span>
                        <span className="s">{Math.round(ex.bestE1rm)} kg e1RM</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="profile-section">
              <div className="field-label">{t.profileGyms}</div>
              {load.gyms.length === 0 ? (
                <div className="detail-muted">{t.profileNoGyms}</div>
              ) : (
                <div className="profile-gym-list">
                  {load.gyms.map((g) => (
                    <div
                      key={g.id}
                      className="gym-card tappable profile-gym-card"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        shell.openOverlay({
                          screen: 'gym',
                          gymId: g.id,
                          name: g.name,
                          lat: g.lat,
                          lng: g.lng,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          shell.openOverlay({
                            screen: 'gym',
                            gymId: g.id,
                            name: g.name,
                            lat: g.lat,
                            lng: g.lng,
                          });
                        }
                      }}
                    >
                      <span className="thumb">
                        <GymThumb name={g.name} lat={g.lat} lng={g.lng} />
                      </span>
                      <div className="gym-card-body">
                        <div className="head">
                          <span className="n">{g.name}</span>
                          {g.favorite ? (
                            <span className="tag tag-accent">{t.pickGymFavourite}</span>
                          ) : null}
                        </div>
                        <div className="meta">
                          <span>
                            {g.sessions} · {fmtTonnes(g.volumeKg)} ·{' '}
                            {g.lastSessionAt ? fmtDayMonth(g.lastSessionAt, locale) : t.stNever}
                          </span>
                          <span>{t.radiusM(g.radiusM)}</span>
                        </div>
                        <span className="profile-gym-coords">
                          {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="profile-section">
            <div className="field-label">{t.adminRecent}</div>
            {load.sessions.length === 0 ? (
              <div className="detail-muted">{t.profileNoTraining}</div>
            ) : (
              <div className="detail-sessions profile-sessions">
                {load.sessions.slice(0, 12).map((s) => (
                  <button
                    key={s.id}
                    className="row"
                    onClick={() =>
                      shell.openOverlay({
                        screen: s.live ? 'session' : 'past-workout',
                        workoutId: s.id,
                      })
                    }
                  >
                    <span>{fmtDayMonth(s.startedAt, locale)}</span>
                    <span>{s.gymName ?? '—'}</span>
                    <span>
                      {s.sets} · {fmtTonnes(s.volumeKg)}
                    </span>
                    <span className="profile-session-ex">
                      {s.live
                        ? t.stTrainingNow
                        : s.durationMs
                          ? fmtDurationHM(s.durationMs)
                          : s.autoFinished
                            ? t.autoClosed
                            : ''}
                      {s.exerciseNames.length > 0 ? ` · ${s.exerciseNames.join(', ')}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {(load.notes.length > 0 || load.viewer.relation === 'trainer') && (
            <section className="profile-section">
              <div className="field-label">
                {load.viewer.relation === 'trainer' ? t.trNotes : t.profileNotes}
              </div>
              {load.notes.length === 0 ? (
                <div className="detail-muted">{t.profileNoNotes}</div>
              ) : (
                load.notes.map((n) => (
                  <div key={n.id} className="tr-note">
                    <div>{n.text}</div>
                    <div className="m">
                      {fmtDayMonth(n.createdAt, locale)} ·{' '}
                      {load.viewer.relation === 'trainer' ? t.trNotePrivate : n.trainerName}
                    </div>
                  </div>
                ))
              )}
              {load.viewer.relation === 'trainer' && (
                <div className="tr-note-add">
                  <input
                    className="input"
                    placeholder={t.trAddNote}
                    value={trainerNote}
                    onChange={(e) => setTrainerNote(e.currentTarget.value)}
                  />
                  <button
                    className="btn btn-secondary"
                    disabled={savingNote || !trainerNote.trim()}
                    onClick={saveTrainerNote}
                  >
                    {savingNote && <Spinner size={12} />} {t.save}
                  </button>
                </div>
              )}
              {noteError && (
                <div className="field-error">
                  <Icon name="warning-circle" />
                  {noteError}
                </div>
              )}
            </section>
          )}

          {load.viewer.relation === 'self' && (
            <section className="profile-section">
              <div className="field-label">{t.profileAuditReads}</div>
              {load.audit.length === 0 ? (
                <div className="detail-muted">{t.profAuditEmpty}</div>
              ) : (
                <div className="detail-sessions">
                  {load.audit.slice(0, 20).map((r, i) => (
                    <div key={`${r.at}-${i}`} className="row">
                      <span>{fmtDayMonth(r.at, locale)}</span>
                      <span>{r.readerName ?? '—'}</span>
                      <span>{r.readerRole}</span>
                      <span>{r.resource}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="profile-stat-section">
      <div className="profile-stat-heading">
        <Icon name={icon} />
        <span>{title}</span>
      </div>
      <div className="stat-grid profile-stat-grid">{children}</div>
    </div>
  );
}

function Stat({
  value,
  label,
  icon,
  accent = false,
}: {
  value: string;
  label: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className={`cell profile-stat-cell${accent ? ' accent' : ''}`}>
      <Icon name={icon} />
      <div>
        <div className="v">{value}</div>
        <div className="l">{label}</div>
      </div>
    </div>
  );
}

function profileName(load: Load, t: ReturnType<typeof useT>['t']): string {
  if (typeof load === 'object') return load.person.name;
  if (load === 'denied') return t.profileAccessDenied;
  if (load === 'missing') return t.profileMissing;
  return t.profileTitle;
}
