/** Full user profile page: direct-link safe, data-rich, role-aware. */
import { ProfileSkeleton } from '../components/ui/Skeletons';
import { EmptyState } from '../components/ui/EmptyState';
import { BackButton } from '../components/ui/BackButton';
import { setWeekStartDay, useWeekStartDay, type IsoDay } from '../weekStart';
import { Switch as KitSwitch, SwitchIndicator } from '../components/ui/Switch';
import { SectionLabel } from '../components/ui/SectionLabel';
import { ListRow } from '../components/ui/GroupedList';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { temperIndex } from '../atlas/types';
import { useEffect, useState, type ReactNode } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import {
  HttpError,
  cacheDelete,
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
import { ConfirmDialog, Icon, LanguageSelector, Sheet, useExerciseName } from '../ui';
import { Avatar, invalidateAvatarCache, seedAvatarCache } from '../components/Avatar';
import { AvatarUploader } from '../components/AvatarUploader';
import { BodyMetricsSection } from '../components/BodyMetrics';
import { useStore, setGlobalWeightUnit } from '../store';
import type { BodyMetrics } from '../types';
import { GymThumb } from '../components/GymThumb';
import type { Shell } from '../App';
import { Select } from '../components/ui/Select';
import { Tag } from '../components/ui/Tag';

interface ProfileData {
  viewer: { id: string; relation: 'self' | 'admin' | 'trainer'; role: string };
  person: {
    id: string;
    name: string;
    username: string;
    firstName: string;
    lastName: string | null;
    role: 'member' | 'trainer' | 'admin';
    status: 'active' | 'invited' | 'suspended';
    joinedAt: number;
    trainerId: string | null;
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
  audit: Array<{ at: number; resource: string; readerName: string | null; readerRole: string }>;
  /** Target user's body metrics for read-only admin/trainer view (§6a.4);
   *  null when the user has none. */
  bodyMetrics: BodyMetrics | null;
}

interface AdminPerson {
  id: string;
  name: string;
  username: string;
  role: 'member' | 'trainer' | 'admin';
  status: 'active' | 'invited' | 'suspended';
  trainerId: string | null;
  trainerName: string | null;
  clientCount: number;
  avatar: boolean;
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
  const exName = useExerciseName();
  const { weightUnit, coach } = useStore();
  const weekStart = useWeekStartDay();
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
  const [ptab, setPtab] = useState<'overview' | 'body' | 'settings'>('overview');
  const [avatarRefresh, setAvatarRefresh] = useState(0);
  const [profileEditing, setProfileEditing] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [assignTrainerOpen, setAssignTrainerOpen] = useState(false);
  const [assignClientsOpen, setAssignClientsOpen] = useState(false);
  const [adminPeople, setAdminPeople] = useState<AdminPerson[] | null>(
    () => cachePeek<AdminPerson[]>('adminPeople')?.data ?? null,
  );
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
  const canAdminManage = typeof load === 'object' && load.viewer.role === 'admin';

  useEffect(() => {
    let alive = true;
    const cacheKey = `profile.${userId}`;
    const cached = cachePeek<ProfileData>(cacheKey);
    // The render already shows the cached copy (see `load` above). Serve it and
    // skip the call when it's still fresh — a navigate-away-and-back within the
    // window costs nothing (AC: fewer reads).
    if (cacheFresh(cached, PROFILE_TTL_MS)) {
      // Seed the edit fields from the cached copy too — otherwise a fresh cache
      // left the name / username inputs empty. Deferred a tick (same as the
      // network path) so the effect itself never sets state synchronously.
      const data = cached!.data;
      if (data.viewer.relation === 'self' || data.viewer.relation === 'admin') {
        const id = window.setTimeout(() => {
          if (!alive) return;
          setEditFirstName(data.person.firstName);
          setEditLastName(data.person.lastName ?? '');
          setEditUsername(data.person.username);
        }, 0);
        return () => {
          alive = false;
          window.clearTimeout(id);
        };
      }
      return;
    }
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

  async function refreshProfile() {
    if (typeof load !== 'object') return;
    const fresh = await callFn<ProfileData>('profileUser', { id: load.person.id });
    commitProfile(fresh);
  }

  async function ensureAdminPeople(): Promise<AdminPerson[]> {
    if (adminPeople) return adminPeople;
    const d = await callFn<{ people: AdminPerson[] }>('adminPeople');
    cacheSet('adminPeople', d.people);
    setAdminPeople(d.people);
    return d.people;
  }

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
        {!embedded && <BackButton label={t.backAction} onClick={onClose} />}
        <div>
          <div className="kicker">{t.profileTitle}</div>
          <h2 className="title-26">{load === 'loading' ? t.profileTitle : profileName(load, t)}</h2>
        </div>
      </div>

      {load === 'loading' && <ProfileSkeleton />}
      {(load === 'denied' || load === 'missing' || load === 'failed') && (
        <EmptyState
          icon="warning-circle"
          title={
            load === 'denied'
              ? t.profileAccessDenied
              : load === 'missing'
                ? t.profileMissing
                : t.error
          }
          body={load === 'denied' ? t.profileAccessDeniedBody : `GET /api/profile/users/${userId}`}
        />
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
                <Tag tone="accent">
                  {load.viewer.relation === 'self' ? t.profileSelf : roleLabel(load.person.role)}
                </Tag>
                {isTrainerView && load.summary.liveSessions > 0 && (
                  <Tag tone="ok" icon={<span className="live-dot" />}>
                    {t.stTrainingNow}
                  </Tag>
                )}
                {embedded && isSelf && canEditDetails && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="profile-mobile-edit"
                    onClick={() => setProfileEditing((x) => !x)}
                  >
                    {profileEditing ? t.done : t.edit}
                  </Button>
                )}
              </div>
              {embedded && isSelf && (
                <p className="profile-mobile-meta">
                  @{load.person.username} · {roleLabel(load.person.role).toLowerCase()}
                </p>
              )}
              {canEditDetails ? (
                <div className="profile-detail-fields" aria-label={t.profileEditTitle}>
                  <Field
                    label={t.firstName}
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.currentTarget.value)}
                    autoComplete="given-name"
                  />
                  <Field
                    label={t.lastName}
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.currentTarget.value)}
                    autoComplete="family-name"
                  />
                  <Field
                    label={t.username}
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.currentTarget.value)}
                    autoComplete="username"
                  />
                  <div className="profile-edit-actions inline">
                    <Button
                      variant="secondary"
                      onClick={() => resetProfileFields(load)}
                      disabled={savingProfile || !profileDirty}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={saveProfile}
                      disabled={
                        savingProfile ||
                        !profileDirty ||
                        editFirstName.trim().length < 2 ||
                        editUsername.trim().length < 2
                      }
                    >
                      {t.save}
                    </Button>
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

          <Segmented
            className="profile-subtabs"
            options={[
              { value: 'overview', label: t.profTabOverview },
              { value: 'body', label: t.profTabBody },
              { value: 'settings', label: t.profileSettings },
            ]}
            value={ptab}
            onChange={setPtab}
          />

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
                  <Segmented
                    size="sm"
                    className="profile-unit-seg"
                    options={(['kg', 'lb'] as const).map((u) => ({ value: u, label: u }))}
                    value={weightUnit}
                    onChange={setGlobalWeightUnit}
                  />
                </div>
                <div className="profile-setting-row static">
                  <Icon name="calendar-blank" />
                  <span>{t.weekStartsOn}</span>
                  <Select
                    className="profile-week-start"
                    value={weekStart}
                    aria-label={t.weekStartsOn}
                    onChange={(e) => setWeekStartDay(Number(e.target.value) as IsoDay)}
                  >
                    {([1, 2, 3, 4, 5, 6, 7] as IsoDay[]).map((d) => (
                      <option key={d} value={d}>
                        {t.weekDayNames[d - 1]}
                      </option>
                    ))}
                  </Select>
                </div>
                <ListRow
                  icon={<Icon name="robot" />}
                  label={`${t.atlasName}${coach.enabled ? ` · ${t.atlasTemper[temperIndex(coach.temper)]}` : ''}`}
                  chevron
                  onClick={() => shell.openOverlay({ screen: 'coach' })}
                />
                <ListRow
                  icon={<Icon name="key" />}
                  label={t.password}
                  chevron
                  onClick={() => setPasswordEditing(true)}
                />
              </section>
              <ListRow
                tone="danger"
                icon={<Icon name="sign-out" />}
                label={t.signOut}
                onClick={() => setConfirmSignOut(true)}
              />
            </>
          )}

          {ptab === 'settings' && canAdminManage && (
            <section className="profile-section profile-admin-actions">
              <SectionLabel>{t.adminAssignedTrainer}</SectionLabel>
              <ListRow
                icon={<Icon name="users-three" />}
                label={t.profileAssignTrainerAction}
                sub={load.person.trainerName ?? t.adminNoTrainer}
                chevron
                onClick={async () => {
                  try {
                    await ensureAdminPeople();
                    setAssignTrainerOpen(true);
                  } catch (e) {
                    shell.toast({
                      kind: 'danger',
                      icon: 'warning-circle',
                      text: e instanceof Error ? e.message : t.error,
                    });
                  }
                }}
              />
              {load.person.role === 'trainer' && (
                <ListRow
                  icon={<Icon name="user-plus" />}
                  label={t.profileAssignClientsAction}
                  sub={t.adminClients(load.person.clientCount)}
                  chevron
                  onClick={async () => {
                    try {
                      await ensureAdminPeople();
                      setAssignClientsOpen(true);
                    } catch (e) {
                      shell.toast({
                        kind: 'danger',
                        icon: 'warning-circle',
                        text: e instanceof Error ? e.message : t.error,
                      });
                    }
                  }}
                />
              )}
            </section>
          )}

          {ptab === 'settings' &&
            canAdminManage &&
            load.person.id !== load.viewer.id &&
            load.person.role !== 'admin' && (
              <ListRow
                icon={<Icon name="barbell" />}
                label={t.profileTrainerPriv}
                sub={t.profileTrainerPrivHint}
                trailing={
                  <KitSwitch
                    checked={load.person.role === 'trainer'}
                    aria-label={t.profileTrainerPriv}
                    onChange={() => void toggleTrainer()}
                  />
                }
              />
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
                <Field
                  label={t.profilePasswordCurrent}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                  autoComplete="current-password"
                />
                <Field
                  label={t.profilePasswordNew}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                  autoComplete="new-password"
                />
                <Field
                  label={t.profilePasswordConfirm}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  autoComplete="new-password"
                />
                <Button
                  variant="secondary"

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
                </Button>
                <Button variant="primary" onClick={savePassword} disabled={!passwordReady}>
                  {t.profilePasswordSave}
                </Button>
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
                        <ListRow
                          key={ex.name}
                          dense
                          label={exName(ex.name)}
                          sub={`${ex.sessions} · ${ex.sets} ${t.sets}`}
                          value={
                            <span className="profile-row-metric">
                              <span className="n">{fmtTonnes(ex.volumeKg)}</span>
                              {ex.bestE1rm !== null && ex.bestE1rm > 0 ? (
                                <span className="s">{Math.round(ex.bestE1rm)} kg e1RM</span>
                              ) : null}
                            </span>
                          }
                          onClick={() =>
                            shell.openOverlay(
                              load.viewer.relation === 'self'
                                ? { screen: 'exercise-history', name: ex.name }
                                : {
                                    screen: 'exercise-history',
                                    name: ex.name,
                                    userId,
                                    userName: load.person.name,
                                  },
                            )
                          }
                        />
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
                              {g.favorite ? <Tag tone="accent">{t.pickGymFavourite}</Tag> : null}
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
                      <ListRow
                        key={s.id}
                        dense
                        label={fmtDayMonth(s.startedAt, locale)}
                        sub={
                          <>
                            {s.gymName ?? '—'}
                            {' · '}
                            {s.live
                              ? t.stTrainingNow
                              : s.durationMs
                                ? fmtDurationHM(s.durationMs)
                                : s.autoFinished
                                  ? t.autoClosed
                                  : ''}
                            {s.exerciseNames.length > 0 ? ` · ${s.exerciseNames.join(', ')}` : ''}
                          </>
                        }
                        value={`${s.sets} · ${fmtTonnes(s.volumeKg)}`}
                        onClick={() => {
                          if (load.viewer.relation === 'self')
                            shell.openOverlay({
                              screen: s.live ? 'session' : 'past-workout',
                              workoutId: s.id,
                            });
                          else if (!s.live)
                            shell.openOverlay({
                              screen: 'trainee-session',
                              athleteId: userId,
                              workoutId: s.id,
                              athleteName: load.person.name,
                            });
                        }}
                      />
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
      {typeof load === 'object' && assignTrainerOpen && adminPeople && (
        <ProfileAssignTrainerSheet
          person={load.person}
          people={adminPeople}
          onClose={() => setAssignTrainerOpen(false)}
          onDone={async () => {
            setAssignTrainerOpen(false);
            cacheDelete('adminPeople');
            setAdminPeople(null);
            await refreshProfile();
            shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileSaved });
          }}
        />
      )}
      {typeof load === 'object' && assignClientsOpen && adminPeople && (
        <ProfileAssignClientsSheet
          trainer={load.person}
          people={adminPeople}
          onClose={() => setAssignClientsOpen(false)}
          onDone={async () => {
            setAssignClientsOpen(false);
            cacheDelete('adminPeople');
            setAdminPeople(null);
            await refreshProfile();
            shell.toast({ kind: 'ok', icon: 'check-circle', text: t.profileSaved });
          }}
        />
      )}
    </div>
  );
}

function ProfileAssignTrainerSheet(props: {
  person: ProfileData['person'];
  people: AdminPerson[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useT();
  const trainers = props.people.filter(
    (p) =>
      (p.role === 'trainer' || p.role === 'admin') &&
      p.status === 'active' &&
      p.id !== props.person.id,
  );
  const [sel, setSel] = useState<string | null>(props.person.trainerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.adminWhoTrains(props.person.name)}</span>
      </div>
      <p className="detail-muted">{t.adminTrainerNote}</p>
      <div className="assign-list">
        {trainers.map((tr) => (
          <ListRow
            key={tr.id}
            icon={<Avatar userId={tr.id} name={tr.name} hasPhoto={tr.avatar} size={34} />}
            label={tr.name}
            sub={t.adminClients(tr.clientCount)}
            selected={sel === tr.id}
            check={sel === tr.id}
            onClick={() => setSel(tr.id)}
          />
        ))}
        <ListRow
          label={t.adminNoTrainer}
          sub={t.adminNoTrainerNote}
          selected={sel === null}
          check={sel === null}
          onClick={() => setSel(null)}
        />
      </div>
      {error && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {error}
        </div>
      )}
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await callFn('adminAssignTrainer', { id: props.person.id, trainerId: sel });
              await props.onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.adminAssign}
        </Button>
      </div>
    </Sheet>
  );
}

function ProfileAssignClientsSheet(props: {
  trainer: ProfileData['person'];
  people: AdminPerson[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useT();
  const candidates = props.people.filter((p) => p.id !== props.trainer.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.filter((p) => p.trainerId === props.trainer.id).map((p) => p.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.profileAssignClientsTitle(props.trainer.name)}</span>
      </div>
      <p className="detail-muted">{t.profileAssignClientsHint}</p>
      <div className="assign-list">
        {candidates.map((p) => {
          const on = selected.has(p.id);
          return (
            <ListRow
              key={p.id}
              icon={<Avatar userId={p.id} name={p.name} hasPhoto={p.avatar} size={34} />}
              label={p.name}
              sub={p.trainerName ?? t.adminNoTrainer}
              selected={on}
              trailing={<SwitchIndicator on={on} size="sm" />}
              onClick={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                })
              }
            />
          );
        })}
      </div>
      {error && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {error}
        </div>
      )}
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              for (const p of candidates) {
                const shouldHave = selected.has(p.id);
                const has = p.trainerId === props.trainer.id;
                if (shouldHave === has) continue;
                await callFn('adminAssignTrainer', {
                  id: p.id,
                  trainerId: shouldHave ? props.trainer.id : null,
                });
              }
              await props.onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.adminAssign}
        </Button>
      </div>
    </Sheet>
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
