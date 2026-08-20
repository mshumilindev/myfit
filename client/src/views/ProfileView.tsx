/** Full user profile page: direct-link safe, data-rich, role-aware. */
import { useEffect, useState, type ReactNode } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import {
  HttpError,
  cacheFresh,
  cachePeek,
  cacheSet,
  callFn,
  currentUid,
  setUsername,
  trackMutation,
} from '../api';
import { db, storage } from '../firebase';
import { fmtDayMonth, fmtDurationHM, fmtTonnes, useT } from '../i18n';
import { ConfirmDialog, Icon, LanguageSelector, Switch, ProfileSkeleton } from '../ui';
import { Avatar, invalidateAvatarCache, seedAvatarCache } from '../components/Avatar';
import { AvatarUploader } from '../components/AvatarUploader';
import { BodyMetricsSection } from '../components/BodyMetrics';
import type { BodyMetrics } from '../types';
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
    bestE1rm: number | null;
  }>;
  notes: Array<{ id: string; text: string; createdAt: number; trainerName: string }>;
  audit: Array<{ at: number; resource: string; readerName: string | null; readerRole: string }>;
  /** Target user's body metrics for read-only admin/trainer view (§6a.4);
   *  null when the user has none. */
  bodyMetrics: BodyMetrics | null;
}

type Load = ProfileData | 'loading' | 'denied' | 'missing' | 'failed';

/** How long a cached profile is served without re-hitting the backend. */
const PROFILE_TTL_MS = 3 * 60 * 1000;

export function ProfileView({
  userId,
  shell,
  onClose,
  embedded = false,
}: {
  userId: string;
  shell: Shell;
  onClose: () => void;
  embedded?: boolean;
}) {
  const { t, locale } = useT();
  const [loaded, setLoaded] = useState<{ userId: string; value: Load }>(() => {
    const cached = cachePeek<ProfileData>(`profile.${userId}`);
    return { userId, value: cached ? cached.data : 'loading' };
  });
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
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [trainerNote, setTrainerNote] = useState('');
  const [ptab, setPtab] = useState<'overview' | 'body' | 'settings'>('overview');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [avatarRefresh, setAvatarRefresh] = useState(0);
  const [profileEditing, setProfileEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // While the fetch for a newly-opened profile is in flight, fall back to any
  // cached copy so the page paints instantly instead of flashing a skeleton.
  const load: Load =
    loaded.userId === userId
      ? loaded.value
      : (cachePeek<ProfileData>(`profile.${userId}`)?.data ?? 'loading');
  const isSelf = typeof load === 'object' && load.viewer.relation === 'self';
  const isTrainerView = typeof load === 'object' && load.viewer.relation === 'trainer';
  const canEditDetails =
    typeof load === 'object' &&
    (load.viewer.relation === 'self' || load.viewer.relation === 'admin');
  const isAdminViewer = typeof load === 'object' && load.viewer.relation === 'admin';

  useEffect(() => {
    let alive = true;
    const cacheKey = `profile.${userId}`;
    const cached = cachePeek<ProfileData>(cacheKey);
    // The render already shows the cached copy (see `load` above). Serve it and
    // skip the call when it's still fresh — a navigate-away-and-back within the
    // window costs nothing (AC: fewer reads).
    if (cacheFresh(cached, PROFILE_TTL_MS)) return;
    callFn<ProfileData>('profileUser', { id: userId })
      .then((data) => {
        cacheSet(cacheKey, data);
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

  // Persist fresh profile data to state + cache together, so an edit keeps the
  // cache current (no stale re-read on the next open).
  const commitProfile = (value: ProfileData) => {
    cacheSet(`profile.${userId}`, value);
    setLoaded({ userId, value });
  };

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
        next = await callFn<ProfileData>('updateProfile', {
          firstName: editFirstName,
          lastName: editLastName,
          username: editUsername,
        });
        setUsername(next.person.name);
      } else {
        await callFn('adminEditUser', {
          id: load.person.id,
          firstName: editFirstName,
          lastName: editLastName,
          username: editUsername,
        });
        next = await callFn<ProfileData>('profileUser', { id: load.person.id });
      }
      setEditFirstName(next.person.firstName);
      setEditLastName(next.person.lastName ?? '');
      setEditUsername(next.person.username);
      commitProfile(next);
      setProfileEditing(false);
      shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileSaved });
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : t.error);
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleTrainer() {
    if (typeof load !== 'object') return;
    const next = load.person.role === 'trainer' ? 'member' : 'trainer';
    try {
      await callFn('adminChangeRole', { id: load.person.id, role: next });
      const fresh = await callFn<ProfileData>('profileUser', { id: load.person.id });
      commitProfile(fresh);
      shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileSaved });
    } catch (e) {
      shell.toast({
        kind: 'danger',
        icon: 'warning-circle',
        text: e instanceof Error ? e.message : t.error,
      });
    }
  }

  function avatarUploaded(previewUrl?: string) {
    if (typeof load !== 'object') return;
    setAvatarRefresh((n) => {
      const next = n + 1;
      if (previewUrl) seedAvatarCache(load.person.id, previewUrl, next);
      return next;
    });
    commitProfile({ ...load, person: { ...load.person, avatar: true } });
    shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileAvatarUpdated });
  }

  async function removeAvatar() {
    if (typeof load !== 'object') return;
    const uid = currentUid();
    if (uid) {
      await trackMutation(
        (async () => {
          await deleteObject(ref(storage, `avatars/${uid}/photo`)).catch(() => undefined);
          await updateDoc(doc(db, 'users', uid), { avatarExt: null, updatedAt: Date.now() });
        })(),
      );
      invalidateAvatarCache(uid);
    }
    commitProfile({ ...load, person: { ...load.person, avatar: false } });
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
      await callFn('changePassword', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordEditing(false);
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
      await callFn('trainerAddNote', { id: load.person.id, text });
      const next = await callFn<ProfileData>('profileUser', { id: userId });
      commitProfile(next);
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
  const pageClass = [
    'screen',
    'profile-page',
    embedded ? 'profile-embedded' : '',
    isSelf ? 'profile-self' : '',
    profileEditing ? 'profile-editing' : '',
    passwordEditing ? 'profile-password-editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={pageClass}>
      <div className="profile-top">
        {!embedded && (
          <button className="profile-back" onClick={onClose} aria-label={t.backAction}>
            <Icon name="caret-left" />
          </button>
        )}
        <div>
          <div className="kicker">{t.profileTitle}</div>
          <h2 className="title-26">{load === 'loading' ? t.profileTitle : profileName(load, t)}</h2>
        </div>
      </div>

      {load === 'loading' && <ProfileSkeleton />}
      {(load === 'denied' || load === 'missing' || load === 'failed') && (
        <div className="empty">
          <Icon name="warning-circle" />
          <h4 className="t">
            {load === 'denied'
              ? t.profileAccessDenied
              : load === 'missing'
                ? t.profileMissing
                : t.error}
          </h4>
          <p className="s">
            {load === 'denied' ? t.profileAccessDeniedBody : `GET /api/profile/users/${userId}`}
          </p>
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
                {isTrainerView && load.summary.liveSessions > 0 && (
                  <span className="profile-live-pill">
                    <span className="live-dot" />
                    {t.stTrainingNow}
                  </span>
                )}
                {embedded && isSelf && canEditDetails && (
                  <button
                    className="profile-mobile-edit"
                    onClick={() => setProfileEditing((x) => !x)}
                  >
                    {profileEditing ? t.done : t.edit}
                  </button>
                )}
              </div>
              {embedded && isSelf && (
                <p className="profile-mobile-meta">
                  @{load.person.username} · {roleLabel(load.person.role).toLowerCase()}
                </p>
              )}
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
                <div className="detail-muted">@{load.person.username}</div>
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

          <div className="seg3 profile-subtabs">
            <button
              className={ptab === 'overview' ? 'active' : ''}
              onClick={() => setPtab('overview')}
            >
              {t.profTabOverview}
            </button>
            <button className={ptab === 'body' ? 'active' : ''} onClick={() => setPtab('body')}>
              {t.profTabBody}
            </button>
            <button
              className={ptab === 'settings' ? 'active' : ''}
              onClick={() => setPtab('settings')}
            >
              {t.profileSettings}
            </button>
          </div>

          {ptab === 'body' &&
            (isSelf ? (
              <BodyMetricsSection readOnly={false} />
            ) : (
              load.bodyMetrics && (
                <BodyMetricsSection readOnly data={load.bodyMetrics} showReadOnlyBadge={false} />
              )
            ))}

          {ptab === 'settings' && !isTrainerView && (
            <section className="profile-section profile-access-section">
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
          )}

          {ptab === 'settings' && isSelf && (
            <>
              <div className="field-label profile-mobile-settings-title">{t.profileSettings}</div>
              <div className="profile-lang">
                <LanguageSelector />
              </div>
              <section className="profile-mobile-settings">
                <div className="profile-setting-row static">
                  <Icon name="scales" />
                  <span>{t.profileUnits}</span>
                  <span>{t.profileUnitsKg}</span>
                </div>
                <button className="profile-setting-row" onClick={() => setPasswordEditing(true)}>
                  <Icon name="key" />
                  <span>{t.password}</span>
                  <Icon name="arrow-right" className="profile-setting-caret" />
                </button>
              </section>
              <button
                className="profile-setting-row profile-signout"
                onClick={() => setConfirmSignOut(true)}
              >
                <Icon name="sign-out" />
                <span>{t.signOut}</span>
              </button>
            </>
          )}

          {ptab === 'settings' &&
            isAdminViewer &&
            load.person.id !== load.viewer.id &&
            load.person.role !== 'admin' && (
              <button className="toggle-row" onClick={() => void toggleTrainer()}>
                <Icon name="barbell" />
                <span className="lab">
                  <div>{t.profileTrainerPriv}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                    {t.profileTrainerPrivHint}
                  </div>
                </span>
                <Switch on={load.person.role === 'trainer'} />
              </button>
            )}

          {profileError && (
            <div className="error-card profile-error">
              <Icon name="warning-circle" />
              <span>{profileError}</span>
            </div>
          )}

          {ptab === 'settings' && isSelf && (
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
                  type="button"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                    setSavingPassword(false);
                    setPasswordEditing(false);
                  }}
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

          {ptab === 'overview' && (
            <>
              {load.viewer.relation === 'trainer' && <TrainerLivePanel load={load} />}

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
                  <Stat
                    icon="flame"
                    value={fmtTonnes(load.summary.volume7)}
                    label={t.profileWeek}
                  />
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

              <section className="profile-columns">
                <div className="profile-section">
                  <div className="field-label">{t.profileTopExercises}</div>
                  {load.topExercises.length === 0 ? (
                    <div className="detail-muted">{t.profileNoTraining}</div>
                  ) : (
                    <div className="profile-list">
                      {load.topExercises.map((ex) => (
                        <button
                          key={ex.name}
                          className="profile-row"
                          onClick={() =>
                            shell.openOverlay({ screen: 'exercise-history', name: ex.name })
                          }
                        >
                          <span>
                            <span className="n">{ex.name}</span>
                            <span className="s">
                              {ex.sessions} · {ex.sets} {t.sets}
                            </span>
                          </span>
                          <span className="profile-row-metric">
                            <span className="n">{fmtTonnes(ex.volumeKg)}</span>
                            {ex.bestE1rm !== null && ex.bestE1rm > 0 ? (
                              <span className="s">{Math.round(ex.bestE1rm)} kg e1RM</span>
                            ) : null}
                          </span>
                        </button>
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

              <section className="profile-section profile-recent-section">
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
            </>
          )}

          {ptab === 'settings' && load.viewer.relation === 'self' && (
            <section className="profile-section profile-audit-section">
              <div className="field-label">{t.profileAuditReads}</div>
              {load.audit.length === 0 ? (
                <div className="detail-muted">{t.profNoAccess}</div>
              ) : (
                <div className="profile-list">
                  {load.audit.map((a) => (
                    <div
                      key={`${a.at}-${a.readerName ?? 'system'}-${a.resource}`}
                      className="profile-row"
                    >
                      <span>
                        <span className="n">{a.readerName ?? roleLabel(a.readerRole)}</span>
                        <span className="s">
                          {roleLabel(a.readerRole)} · {a.resource}
                        </span>
                      </span>
                      <span className="s">{fmtDayMonth(a.at, locale)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {ptab === 'overview' && (load.notes.length > 0 || load.viewer.relation === 'trainer') && (
            <section className="profile-section profile-notes-section">
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
                    {t.save}
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
        </>
      )}
      {confirmSignOut && (
        <ConfirmDialog
          title={t.signOutTitle}
          body={shell.queueLength > 0 ? t.signOutQueueBody(shell.queueLength) : t.signOutCleanBody}
          confirmLabel={t.signOut}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            setConfirmSignOut(false);
            shell.signOut();
          }}
        />
      )}
    </div>
  );
}

function TrainerLivePanel({ load }: { load: ProfileData }) {
  const { t } = useT();
  const live = load.sessions.find((s) => s.live);
  if (!live) return null;
  const primary = live.exerciseNames[0] ?? t.stTrainingNow;

  return (
    <section className="profile-section tr-live-panel">
      <div className="field-label">{t.trLiveNow}</div>
      <div className="tr-live-card">
        <div className="tr-live-head">
          <span>{primary}</span>
          <span>
            {live.sets} · {fmtTonnes(live.volumeKg)}
          </span>
        </div>
        <div className="tr-live-grid">
          <span>#</span>
          <span>{t.setsStat}</span>
          <span>{t.profileLifetime}</span>
          <strong>1</strong>
          <strong>{live.sets}</strong>
          <strong>{fmtTonnes(live.volumeKg)}</strong>
        </div>
        <p>{t.trLiveReadOnly}</p>
      </div>
    </section>
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
