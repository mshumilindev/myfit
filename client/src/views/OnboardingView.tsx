/** Onboarding — design O-01…O-09. Steps end inside a live session. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { callFn, signInWithPayload, currentUid, type AuthPayload } from '../api';
import {
  addWeight,
  startWorkout,
  updateBodyMetrics,
  upsertGym,
  getCurrentPositionOnce,
} from '../store';
import { DEFAULT_GYM_RADIUS_M } from '../types';
import {
  searchGyms,
  haversineM,
  fmtDistance,
  cacheAddress,
  type Coords,
  type PlaceResult,
} from '../data/gymProviders';
import { fmtDayMonth, useT } from '../i18n';
import { fullPersonName, splitPersonName } from '../name';
import { SpotterMark } from '../brand/SpotterMark';
import { Icon, LanguageSelector, ScreenSkeleton } from '../ui';
import { GymThumb } from '../components/GymThumb';
import { Avatar } from '../components/Avatar';
import { AvatarUploader } from '../components/AvatarUploader';
import { InstallShortcut } from './InstallShortcut';

interface InviteInfo {
  state: 'valid' | 'expired' | 'claimed' | 'revoked';
  kind: 'invite' | 'reset';
  inviter: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  expiresAt: number;
  claimedAt: number | null;
  revokedAt: number | null;
}

interface Resume {
  step: number;
  name: string;
  firstName?: string;
  lastName?: string;
  gymId?: string;
  gymName?: string;
  gymLat?: number;
  gymLng?: number;
  avatarDone?: boolean;
}

const resumeKey = (token: string) => `onb.${token}`;

function loadResume(token: string): Resume | null {
  try {
    const raw = localStorage.getItem(resumeKey(token));
    return raw ? (JSON.parse(raw) as Resume) : null;
  } catch {
    return null;
  }
}

export function OnboardingView({
  token,
  onDone,
}: {
  token: string;
  onDone: (workoutId?: string) => void;
}) {
  const { t, locale } = useT();
  const [info, setInfo] = useState<InviteInfo | null | 'error'>(null);
  const saved = useMemo(() => loadResume(token), [token]);
  const savedName = splitPersonName(saved?.name ?? '');
  // 0 = landing, 1..4 = steps.
  const [step, setStep] = useState(saved?.step ?? 0);
  const [firstName, setFirstName] = useState(saved?.firstName ?? savedName.firstName);
  const [lastName, setLastName] = useState(saved?.lastName ?? savedName.lastName);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gym, setGym] = useState<Resume | null>(saved);
  const name = fullPersonName(firstName, lastName);
  const [requested, setRequested] = useState(false);

  // AC-ONB-06: persist on every meaningful change.
  function persist(patch: Partial<Resume>): void {
    const cur = loadResume(token) ?? { step, name, firstName, lastName };
    const next = { ...cur, step, name, firstName, lastName, ...patch };
    localStorage.setItem(resumeKey(token), JSON.stringify(next));
  }

  useEffect(() => {
    callFn<InviteInfo>('invitePreview', { token })
      .then((i) => {
        setInfo(i);
        if (i.state === 'valid') {
          const invited = splitPersonName(i.name ?? '');
          setFirstName((n) => n || i.firstName || invited.firstName);
          setLastName((n) => n || i.lastName || invited.lastName);
        }
      })
      .catch(() => setInfo('error'));
  }, [token]);

  if (info === null) {
    return <ScreenSkeleton />;
  }

  const resumable = saved !== null && !!currentUid();
  if (info === 'error' || (info.state !== 'valid' && !resumable)) {
    const when =
      info !== 'error' && (info.claimedAt ?? info.revokedAt ?? info.expiresAt)
        ? fmtDayMonth(info.claimedAt ?? info.revokedAt ?? info.expiresAt, locale)
        : '';
    return (
      <div className="onb-shell center">
        <div className="onb-card">
          <Icon name="warning-circle" className="onb-dead-icon" />
          <h2>{t.onbDead}</h2>
          <p className="lead">{t.onbDeadBody(when)}</p>
          <button
            className="btn btn-primary btn-big"
            disabled={requested}
            onClick={() => {
              void callFn('requestNewInvite', { token }).catch(() => {});
              setRequested(true);
            }}
          >
            {requested ? t.onbRequested : t.onbRequestNew}
          </button>
          <button className="footer-link" onClick={() => onDone()}>
            {t.onbHaveAccount}
          </button>
        </div>
      </div>
    );
  }

  const totalSteps = 4;
  const railBars = (upTo: number) => (
    <div className="onb-rail" aria-hidden>
      {Array.from({ length: totalSteps }, (_, index) => index + 1).map((i) => (
        <span key={i} className={`bar${i <= upTo ? ' on' : ''}`} />
      ))}
    </div>
  );
  const stepNames = ['', t.onbWho, t.onbFace, t.onbGymStep, t.onbBodyStep];
  const rail = (
    <div className="onb-steptop">
      {railBars(Math.min(Math.max(step, 1), totalSteps))}
      <div className="row">
        <span className="k">{t.onbStepOf(Math.min(step, totalSteps))}</span>
        <span className="k right">{stepNames[Math.min(step, totalSteps)]}</span>
      </div>
    </div>
  );

  async function claim(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await callFn<AuthPayload>('claim', {
        token,
        password,
        username: name,
        firstName,
        lastName,
      });
      await signInWithPayload(res);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Reset links are a single step: set the new password, done.
  if (info.kind === 'reset' && step === 0) {
    return (
      <div className="onb-shell center">
        <div className="onb-card">
          <h2>{t.onbWho}</h2>
          <input
            className="input"
            type="password"
            placeholder={t.passwordMin}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-big"
            disabled={busy || password.length < 6}
            onClick={async () => {
              if (await claim()) onDone();
            }}
          >
            {t.save}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onb-shell">
      <div className="onb-top">
        {step > 1 ? (
          <button
            className="back"
            aria-label={t.onbBack}
            onClick={() => {
              setStep(step - 1);
              persist({ step: step - 1 });
            }}
          >
            <Icon name="caret-left" />
          </button>
        ) : (
          <span />
        )}
        <LanguageSelector />
      </div>

      {step === 0 && (
        <div className="onb-card landing">
          <SpotterMark size={48} variant="tight" className="onb-wordmark" />
          <h2 className="display">{t.onbTitle}</h2>
          <p className="lead">{t.onbBody}</p>
          {railBars(1)}
          <button
            className="btn btn-primary btn-big"
            onClick={() => {
              setStep(1);
              persist({ step: 1 });
            }}
          >
            {t.onbStart} <Icon name="arrow-right" />
          </button>
          <InstallShortcut />
          <div className="footnote center">
            {t.onbLinkValid(fmtDayMonth(info.expiresAt, locale))}
          </div>
          {info.inviter && (
            <div className="onb-inviter">
              <Avatar name={info.inviter} size={40} />
              <span>{t.onbInvited(info.inviter)}</span>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="onb-card">
          {rail}
          <h2 className="display sm">{t.onbWhoLead}</h2>
          <input
            className="input"
            placeholder={t.firstName}
            value={firstName}
            onBlur={() => persist({})}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="input"
            placeholder={t.lastName}
            value={lastName}
            onBlur={() => persist({})}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className={`input${error ? ' error' : ''}`}
            type="password"
            placeholder={t.passwordMin}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )}
          {info.name && (
            <div className="note-ok">
              <Icon name="check-circle" weight="fill" />
              <span>{t.onbPrefilled}</span>
            </div>
          )}
          <button
            className="btn btn-primary btn-big"
            disabled={busy || firstName.trim().length < 2 || password.length < 6}
            onClick={async () => {
              // Already claimed on a previous run → just advance.
              if (currentUid() && loadResume(token)) {
                setStep(2);
                persist({ step: 2 });
                return;
              }
              if (await claim()) {
                setStep(2);
                persist({ step: 2 });
              }
            }}
          >
            {t.onbContinue} <Icon name="arrow-right" />
          </button>
        </div>
      )}

      {step === 2 && (
        <AvatarStep
          rail={rail}
          onDone={(had) => {
            setStep(3);
            persist({ step: 3, avatarDone: had });
          }}
        />
      )}

      {step === 3 && (
        <GymStep
          rail={rail}
          onPick={(r) => {
            if (r) {
              const g = upsertGym({
                name: r.name,
                lat: r.lat,
                lng: r.lng,
                radiusM: DEFAULT_GYM_RADIUS_M,
              });
              if (r.address) cacheAddress(r.lat, r.lng, r.address);
              setGym({
                step: 4,
                name,
                firstName,
                lastName,
                gymId: g.id,
                gymName: g.name,
                gymLat: g.lat,
                gymLng: g.lng,
              });
              persist({ step: 4, gymId: g.id, gymName: g.name, gymLat: g.lat, gymLng: g.lng });
            } else {
              setGym({ step: 4, name, firstName, lastName });
              persist({ step: 4, gymId: undefined, gymName: undefined });
            }
            setStep(4);
          }}
        />
      )}

      {step === 4 && (
        <BodyStep
          rail={rail}
          onContinue={() => {
            setStep(5);
            persist({ step: 5 });
          }}
        />
      )}

      {step === 5 && (
        <div className="onb-final">
          {gym?.gymName && gym.gymLat !== undefined && gym.gymLng !== undefined && (
            <div className="onb-final-bg">
              <GymThumb name={gym.gymName} lat={gym.gymLat} lng={gym.gymLng} size={320} />
            </div>
          )}
          <div className="onb-final-scrim" />
          <div className="onb-card final">
            <div className="kicker onb-ready">
              <Icon name="check-circle" weight="fill" /> {t.onbReady}
              {gym?.gymName ? ` · ${gym.gymName}` : ''}
            </div>
            <div className="onb-me">
              <Avatar name={name} size={76} />
              <div>
                <div className="n">{name}</div>
                {info.inviter && (
                  <div className="s">
                    {t.roleAdmin} · {info.inviter}
                  </div>
                )}
              </div>
            </div>
            <h2 className="display">{t.onbWow}</h2>
            <p className="lead">{gym?.gymName ? t.onbWowBody(gym.gymName) : t.onbWowBodyNoGym}</p>
            <button
              className="btn btn-primary btn-big"
              onClick={() => {
                localStorage.removeItem(resumeKey(token));
                const w = startWorkout(gym?.gymId ?? null);
                onDone(w.id);
              }}
            >
              <Icon name="play" /> {t.onbStartTraining}
            </button>
            <button
              className="footer-link"
              onClick={() => {
                localStorage.removeItem(resumeKey(token));
                onDone();
              }}
            >
              {t.onbJustApp}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Step 2: avatar with circular crop + zoom (O-03/O-04, AC-AVATAR) --------

function AvatarStep({ rail, onDone }: { rail: React.ReactNode; onDone: (had: boolean) => void }) {
  const { t } = useT();

  return (
    <div className="onb-card">
      {rail}
      <h2 className="display sm">{t.onbFaceLead}</h2>
      <AvatarUploader
        name={t.onbFace}
        onUploaded={() => onDone(true)}
        idleFooter={
          <>
            <div className="footnote center">{t.onbFaceNote}</div>
            <button className="btn btn-primary btn-big" onClick={() => onDone(false)}>
              {t.onbContinue} <Icon name="arrow-right" />
            </button>
            <button className="footer-link" onClick={() => onDone(false)}>
              {t.onbSkipInitials}
            </button>
          </>
        }
      />
    </div>
  );
}

// --- Step 4: body metrics — height + current weight required, rest optional --

function bmNum(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function BodyStep({ rail, onContinue }: { rail: ReactNode; onContinue: () => void }) {
  const { t } = useT();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const h = bmNum(height);
  const w = bmNum(weight);
  const ready = h != null && h > 0 && w != null && w > 0;

  const row = (
    label: string,
    unit: string,
    value: string,
    set: (v: string) => void,
    req?: boolean,
  ) => (
    <label className="onb-bm-field">
      <span className="onb-bm-label">
        {label}
        {req && <span className="onb-bm-req"> *</span>}
      </span>
      <span className="onb-bm-in">
        <input
          className="input"
          inputMode="decimal"
          placeholder="—"
          value={value}
          onChange={(e) => set(e.target.value)}
        />
        <span className="onb-bm-unit">{unit}</span>
      </span>
    </label>
  );

  return (
    <div className="onb-card">
      {rail}
      <h2 className="display sm">{t.onbBodyLead}</h2>
      <p className="lead">{t.onbBodyNote}</p>
      <div className="onb-bm-two">
        {row(t.bmHeight, 'cm', height, setHeight, true)}
        {row(t.bmCurrentWeight, 'kg', weight, setWeight, true)}
      </div>
      <div className="onb-bm-two">
        {row(t.bmGoal, 'kg', goal, setGoal)}
        {row(t.bmBodyFat, '%', bodyFat, setBodyFat)}
      </div>
      {row(t.bmMuscle, 'kg', muscle, setMuscle)}
      <button
        className="btn btn-primary btn-big"
        disabled={!ready}
        onClick={() => {
          updateBodyMetrics({
            heightCm: h,
            goalWeightKg: bmNum(goal),
            bodyFatPct: bmNum(bodyFat),
            muscleKg: bmNum(muscle),
          });
          addWeight(w as number, Date.now());
          onContinue();
        }}
      >
        {t.onbContinue} <Icon name="arrow-right" />
      </button>
    </div>
  );
}

// --- Step 3: gym (O-05) — nearby first, search, never blocks on permission --

function GymStep({
  rail,
  onPick,
}: {
  rail: React.ReactNode;
  onPick: (r: PlaceResult | null) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [nearby, setNearby] = useState<PlaceResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentPositionOnce()
      .then((p) => alive && setCoords({ lat: p.lat, lng: p.lng }))
      .catch(() => alive && setDenied(true));
    return () => {
      alive = false;
    };
  }, []);

  const needle = q.trim();
  useEffect(() => {
    abortRef.current?.abort();
    if (needle.length < 2) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const deb = setTimeout(() => {
      void searchGyms(needle, coords, {}, [], ctrl.signal, {
        onResults: (m) => {
          if (!ctrl.signal.aborted) setResults([...m]);
        },
        onProvider: () => {},
      });
    }, 350);
    return () => {
      clearTimeout(deb);
      ctrl.abort();
    };
  }, [needle, coords]);

  useEffect(() => {
    if (!coords) return;
    const ctrl = new AbortController();
    void searchGyms(t.nearbyQuery, coords, {}, [], ctrl.signal, {
      onResults: (m) => {
        if (!ctrl.signal.aborted) setNearby([...m]);
      },
      onProvider: () => {},
    });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const sorted = useMemo(() => {
    if (!coords) return results;
    return [...results].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  }, [results, coords]);
  const nearbySorted = useMemo(() => {
    if (!coords) return [] as PlaceResult[];
    return [...nearby].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  }, [nearby, coords]);
  const showNearby = needle.length < 2;
  const list = showNearby ? nearbySorted : sorted;

  return (
    <div className="onb-card">
      {rail}
      <h2>{t.onbGymStep}</h2>
      <p className="lead">{t.onbGymLead}</p>
      <div className="searchbar">
        <Icon name="magnifying-glass" />
        <input
          value={q}
          placeholder={t.searchGymPlaceholder}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {denied && (
        <div className="banner">
          <Icon name="map-pin-slash" />
          <span>{t.locationBlockedBody}</span>
        </div>
      )}
      {showNearby && list.length > 0 && (
        <div className="onb-near">
          <Icon name="crosshair" />
          <span>{t.onbNearYou(fmtDistance(2000))}</span>
        </div>
      )}
      <div className="onb-gym-list">
        {list.slice(0, 4).map((r) => {
          const d = coords ? haversineM(coords, r) : null;
          return (
            <button key={r.key} className="onb-gym-card" onClick={() => onPick(r)}>
              <span className="photo">
                <GymThumb name={r.name} lat={r.lat} lng={r.lng} size={120} />
              </span>
              <span className="body">
                <span className="n">{r.name}</span>
                <span className="s">
                  {r.address ?? ''}
                  {d !== null ? `${r.address ? ' · ' : ''}${fmtDistance(d)}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button className="footer-link" onClick={() => onPick(null)}>
        {t.onbSkipGym}
      </button>
    </div>
  );
}
