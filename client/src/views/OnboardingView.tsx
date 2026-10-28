/** Onboarding — design O-01…O-09. Steps end inside a live session. */
import { BackButton } from '../components/ui/BackButton';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { callFn, signInWithPayload, currentUid, type AuthPayload } from '../api';
import { addWeight, startWorkout, updateBodyMetrics, upsertGym } from '../store';
import { DEFAULT_GYM_RADIUS_M } from '../types';
import { cacheAddress } from '../data/gymProviders';
import { fmtDayMonth, useT } from '../i18n';
import { RegistrationAgreement, useAgreementGate } from '../legal/AgreementBlock';
import { recordSignupConsents } from '../legal/signupConsents';
import { fullPersonName, splitPersonName } from '../name';
import { SpotterMark } from '../brand/SpotterMark';
import { Icon, LanguageSelector } from '../ui';
import { GymThumb } from '../components/GymThumb';
import { UserAvatar } from '../components/Avatar';
import { AvatarUploader } from '../components/AvatarUploader';
import { GymStep } from './OnboardingGymStep';
import { OnboardingThemeStep } from './OnboardingThemeStep';
import { InstallShortcut } from './InstallShortcut';
import { OnbLandingSkeleton } from './OnbLandingSkeleton';
import { ConditionPage, ConditionsOnboardingRow } from './health/Conditions';
import { NicotineOnboardingRow } from './health/nicotine/NicotineSection';
import { NicotineProductsView } from './health/nicotine/NicotineProductsView';
import { AlcoholOnboardingRow } from './health/alcohol/AlcoholSection';
import { AlcoholProductsView } from './health/alcohol/AlcoholProductsView';
import { SupplementOnboardingRow } from './health/supplements/SupplementSection';
import { SupplementProductsView } from './health/supplements/SupplementProductsView';
import { SupplementQuickStartSheet } from './health/supplements/SupplementQuickStartSheet';

interface InviteInfo {
  state: 'valid' | 'expired' | 'claimed' | 'revoked';
  kind: 'invite' | 'reset';
  inviter: string | null;
  inviterId: string | null;
  inviterAvatar: boolean;
  inviterAvatarUrl: string | null;
  username: string | null;
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
  username?: string;
  firstName?: string;
  lastName?: string;
  gymId?: string;
  gymName?: string;
  gymLat?: number;
  gymLng?: number;
  avatarDone?: boolean;
}

const resumeKey = (token: string) => `onb.${token}`;

/** The legal documents shown before the account is created; ids are their public routes (`#/terms`, `#/privacy`). */
const AGREE_DOCS = ['terms', 'privacy'] as const;

function loadResume(token: string): Resume | null {
  try {
    const raw = localStorage.getItem(resumeKey(token));
    return raw ? (JSON.parse(raw) as Resume) : null;
  } catch {
    return null;
  }
}

export function OnboardingView(props: {
  token: string;
  onDone: (workoutId?: string) => void;
  skipLanding?: boolean;
}) {
  const { token, onDone, skipLanding = false } = props;
  const { t, locale } = useT();
  const [info, setInfo] = useState<InviteInfo | null | 'error'>(null);
  const saved = useMemo(() => loadResume(token), [token]);
  const savedName = splitPersonName(saved?.name ?? '');
  // 0 = landing, 1..4 = steps. Every open starts on the landing screen — the
  // saved data still prefills the fields and the one-time claim below is never
  // re-run (the step-1 handler detects an existing account and just advances) —
  // so a half-finished invite reopens at step 0, not mid-flow.
  const [step, setStep] = useState(skipLanding ? 1 : 0);
  const [firstName, setFirstName] = useState(saved?.firstName ?? savedName.firstName);
  const [lastName, setLastName] = useState(saved?.lastName ?? savedName.lastName);
  const [username, setUsername] = useState(saved?.username ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gym, setGym] = useState<Resume | null>(saved);
  const name = fullPersonName(firstName, lastName);
  const [requested, setRequested] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [nicOpen, setNicOpen] = useState(false);
  const [alcOpen, setAlcOpen] = useState(false);
  const [supQuick, setSupQuick] = useState(false);
  const [supOpen, setSupOpen] = useState(false);
  const [condKey, setCondKey] = useState<string | undefined>();
  const agreement = useAgreementGate(AGREE_DOCS);

  // AC-ONB-06: persist on every meaningful change.
  function persist(patch: Partial<Resume>): void {
    const cur = loadResume(token) ?? { step, name, username, firstName, lastName };
    const next = { ...cur, step, name, username, firstName, lastName, ...patch };
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
          setUsername((n) => n || i.username || i.name || '');
        }
      })
      .catch(() => setInfo('error'));
  }, [token]);

  // Read-before-accept guards account creation; a person who already has the account (resumed invite) is not asked again.
  const needsAgreement = !(currentUid() && loadResume(token));

  /**
   * Opens a legal document in a NEW tab/window: the hash router has no back-stack that keeps this step's typed (and
   * unsaved password) state, so the onboarding page stays alive underneath. If the browser blocks the new window, the
   * document opens in this tab instead (the typed names are saved first; the opened/ticked state starts again).
   */
  function openLegalDoc(id: string): void {
    const url = `${window.location.pathname}${window.location.search}#/${id}`;
    const w = window.open(url, '_blank');
    if (w) {
      w.opener = null;
      return;
    }
    persist({});
    window.location.hash = `#/${id}`;
  }

  if (info === null) {
    return <OnbLandingSkeleton />;
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
          <Button
            variant="primary"
            size="lg"
            disabled={requested}
            onClick={() => {
              void callFn('requestNewInvite', { token }).catch(() => {});
              setRequested(true);
            }}
          >
            {requested ? t.onbRequested : t.onbRequestNew}
          </Button>
          <Button variant="link" onClick={() => onDone()}>
            {t.onbHaveAccount}
          </Button>
        </div>
      </div>
    );
  }

  const totalSteps = 5;
  const railBars = (upTo: number) => (
    <div className="onb-rail" aria-hidden>
      {Array.from({ length: totalSteps }, (_, index) => index + 1).map((i) => (
        <span key={i} className={`bar${i <= upTo ? ' on' : ''}`} />
      ))}
    </div>
  );
  const stepNames = ['', t.onbWho, t.onbFace, t.onbGymStep, t.onbBodyStep, t.onbLook];
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
        username: username.trim(),
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
          <Field
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
          <Button
            variant="primary"
            size="lg"
            disabled={busy || password.length < 6}
            onClick={async () => {
              if (await claim()) onDone();
            }}
          >
            {t.save}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="onb-shell">
      <div className="onb-top">
        {step > 0 ? (
          <BackButton
            label={t.onbBack}
            onClick={() => {
              setStep(step - 1);
              persist({ step: step - 1 });
            }}
          />
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
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setStep(1);
              persist({ step: 1 });
            }}
          >
            {t.onbStart} <Icon name="arrow-right" />
          </Button>
          <InstallShortcut />
          <div className="footnote center">
            {t.onbLinkValid(fmtDayMonth(info.expiresAt, locale))}
          </div>
          {info.inviter && (
            <div className="onb-inviter">
              {info.inviterAvatarUrl ? (
                <img className="avatar lighten" src={info.inviterAvatarUrl} alt="" />
              ) : (
                <UserAvatar
                  userId={info.inviterId ?? undefined}
                  name={info.inviter}
                  hasPhoto={info.inviterAvatar}
                  size={40}
                />
              )}
              <span>{t.onbInvited(info.inviter)}</span>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="onb-card">
          {rail}
          <h2 className="display sm">{t.onbWhoLead}</h2>
          <Field
            placeholder={t.firstName}
            value={firstName}
            onBlur={() => persist({})}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Field
            placeholder={t.lastName}
            value={lastName}
            onBlur={() => persist({})}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Field
            placeholder={t.username}
            value={username}
            onBlur={() => persist({})}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Field
            error={
              error ? (
                <>
                  <Icon name="warning-circle" /> {error}
                </>
              ) : undefined
            }
            type="password"
            placeholder={t.passwordMin}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {info.name && (
            <div className="note-ok">
              <Icon name="check-circle" weight="fill" />
              <span>{t.onbPrefilled}</span>
            </div>
          )}
          {needsAgreement && <RegistrationAgreement gate={agreement} onOpen={openLegalDoc} />}
          <Button
            variant="primary"
            size="lg"
            disabled={
              busy ||
              firstName.trim().length < 2 ||
              username.trim().length < 2 ||
              password.length < 6 ||
              (needsAgreement && !agreement.canContinue)
            }
            onClick={async () => {
              // Already claimed on a previous run → just advance.
              if (currentUid() && loadResume(token)) {
                setStep(2);
                persist({ step: 2 });
                return;
              }
              if (await claim()) {
                // The account exists: record terms / policy-ack / age-18 (queued locally if offline; never blocks).
                void recordSignupConsents(locale);
                setStep(2);
                persist({ step: 2 });
              }
            }}
          >
            {t.onbContinue} <Icon name="arrow-right" />
          </Button>
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
                username,
                firstName,
                lastName,
                gymId: g.id,
                gymName: g.name,
                gymLat: g.lat,
                gymLng: g.lng,
              });
              persist({ step: 4, gymId: g.id, gymName: g.name, gymLat: g.lat, gymLng: g.lng });
            } else {
              setGym({ step: 4, name, username, firstName, lastName });
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
        <OnboardingThemeStep
          rail={rail}
          onContinue={() => {
            setStep(6);
            persist({ step: 6 });
          }}
        />
      )}

      {step === 6 && condOpen && (
        <ConditionPage
          cond="new"
          condKey={condKey}
          web={false}
          onBack={() => {
            setCondOpen(false);
            setCondKey(undefined);
          }}
          onPickKey={setCondKey}
        />
      )}

      {step === 6 && nicOpen && <NicotineProductsView onBack={() => setNicOpen(false)} />}

      {step === 6 && alcOpen && <AlcoholProductsView onBack={() => setAlcOpen(false)} />}

      {step === 6 && supOpen && <SupplementProductsView onBack={() => setSupOpen(false)} />}

      {step === 6 && !condOpen && !nicOpen && !alcOpen && !supOpen && (
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
              <UserAvatar name={name} size={76} />
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
            <ConditionsOnboardingRow onOpen={() => setCondOpen(true)} />
            <NicotineOnboardingRow onOpen={() => setNicOpen(true)} />
            <AlcoholOnboardingRow onOpen={() => setAlcOpen(true)} />
            <SupplementOnboardingRow onOpen={() => setSupQuick(true)} />
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                localStorage.removeItem(resumeKey(token));
                const w = startWorkout(gym?.gymId ?? null);
                if (!w) return;
                onDone(w.id);
              }}
            >
              <Icon name="play" /> {t.onbStartTraining}
            </Button>
            <Button
              variant="link"

              onClick={() => {
                localStorage.removeItem(resumeKey(token));
                onDone();
              }}
            >
              {t.onbJustApp}
            </Button>
          </div>
        </div>
      )}

      {step === 6 && supQuick && (
        <SupplementQuickStartSheet
          onClose={() => setSupQuick(false)}
          onMore={() => {
            setSupQuick(false);
            setSupOpen(true);
          }}
        />
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
            <Button variant="primary" size="lg" onClick={() => onDone(false)}>
              {t.onbContinue} <Icon name="arrow-right" />
            </Button>
            <Button variant="link" onClick={() => onDone(false)}>
              {t.onbSkipInitials}
            </Button>
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
        <Field
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
      <Button
        variant="primary"
        size="lg"
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
      </Button>
    </div>
  );
}
