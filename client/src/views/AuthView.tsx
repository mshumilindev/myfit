/** Auth — design S-01. Sign-in only; new accounts come via invite onboarding. */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { BackButton } from '../components/ui/BackButton';
import { Avatar } from '../components/ui/Avatar';
import { LockerWall } from '../components/ui/LockerWall';
import { LegalLinks } from '../components/ui/LegalLinks';
import { readRemembered, setPasskey } from '../accounts/rememberedPeople';
import { biometricsAvailable, registerPasskey, signInWithPasskey } from '../accounts/passkey';
import { HttpError, callFn, signInWithPayload, type AuthPayload } from '../api';
import { SpotterMark } from '../brand/SpotterMark';
import { fmtSessionClock, useT } from '../i18n';
import { useLegalT } from '../i18n/legal';
import { Icon, LanguageSelector } from '../ui';
import { InstallShortcut } from './InstallShortcut';
import './AuthView.css';

/** The reachability probe gives up after this long; sign-in is never held back by it. */
const PROBE_TIMEOUT_MS = 6_000;

/** When a 15-minute lockout that starts now ends. */
function lockoutEnd(): number {
  return Date.now() + 15 * 60 * 1000;
}

export function AuthView({
  onLoggedIn,
  notice,
}: {
  onLoggedIn: () => void;
  /** Optional note above the title (a team link explains who invited the person). */
  notice?: ReactNode;
}) {
  const { t } = useT();
  const { lg } = useLegalT();
  const [unreachable, setUnreachable] = useState(false);
  // The server answered slowly or not at all, but the browser is online: the
  // form stays usable (the reachability probe never gates sign-in), with a hint.
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  // People this device remembers (SPO-210). With any, the landing opens on the Locker Wall; "Use another account" opens the plain form.
  const [people] = useState(() => {
    try {
      return readRemembered(localStorage);
    } catch {
      return [];
    }
  });
  const [wall, setWall] = useState(people.length > 0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = people.find((p) => p.uid === pickedId) ?? null;
  const person = picked && picked.login ? picked : null;
  const personView = person !== null;
  const wallView = people.length > 0 && wall && !personView;
  const formView = !wallView && !personView;
  // A biometric prompt is in flight for the picked person: only the locker shows, no password field.
  const [bio, setBio] = useState(false);
  const pick = (uid: string) => {
    const p = people.find((x) => x.uid === uid);
    setError(null);
    setPassword('');
    if (!p?.login) {
      setWall(false); // an entry without a sign-in name cannot skip the form
      return;
    }
    setPickedId(uid);
    if (!p.passkey) return;
    setBio(true);
    void biometricsAvailable()
      .then((ok) => {
        if (!ok) throw new Error('unavailable');
        return signInWithPasskey(p.uid);
      })
      .then(async (res) => {
        await signInWithPayload(res, true);
        onLoggedIn();
      })
      .catch(() => setBio(false)); // cancelled or unusable: the password field appears
  };

  function check() {
    callFn<{ registered: boolean }>('authStatus', undefined, { timeoutMs: PROBE_TIMEOUT_MS })
      .then(() => setUnreachable(false))
      .catch((err) => {
        // Only a genuine lack of connection blocks auth (the first sign-in needs
        // one); a slow or erroring server leaves the form usable with a hint.
        const status = err instanceof HttpError ? err.status : 0;
        const offline = !navigator.onLine;
        setUnreachable(offline);
        setSlow(!offline && (status === 503 || status === 504));
      });
  }
  function probe() {
    setSlow(false);
    check();
  }
  useEffect(() => {
    check();
    // Coming back online re-checks on its own.
    const onOnline = () => {
      setSlow(false);
      check();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    if (lockUntil === null) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [lockUntil]);
  const locked = lockUntil !== null && lockUntil > now;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callFn<AuthPayload>('login', {
        identifier: person ? person.login : identifier.trim(),
        password,
      });
      // A remembered person signing in again stays remembered.
      await signInWithPayload(res, remember || person !== null);
      // A remembered sign-in on a device with biometrics quietly sets up the passkey for next time.
      if ((remember || person !== null) && !person?.passkey) {
        void registerPasskey().then((ok) => {
          if (ok) setPasskey(localStorage, res.userId, true);
        });
      }
      onLoggedIn();
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) setError(t.wrongCredentials);
      else if (err instanceof HttpError && err.status === 429) setLockUntil(lockoutEnd());
      else if (err instanceof HttpError) setError(err.message || t.error);
      else {
        // signInWithCustomToken failures land here (auth/*, network, etc.)
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.replace(/^Firebase:\s*/, '') || t.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-body" onSubmit={submit}>
      <div className="auth-card">
        <div className="auth-lang">
          <LanguageSelector />
        </div>
        <SpotterMark size={88} variant="tight" className="wordmark" />
        {notice}
        <h2 className="auth-title">{wallView || personView ? t.authWelcomeBack : t.appName}</h2>
        <p className="auth-sub">
          {wallView || bio
            ? t.authTapFace
            : person
              ? t.authPersonPassword(person.name)
              : t.authTagline}
        </p>

        {unreachable && (
          <div
            className="banner danger-ring"
            role="status"
            style={{ margin: 'var(--space-2) 0 var(--space-4)' }}
          >
            <Icon name="cloud-slash" />
            <span>{t.serverUnreachable}</span>
          </div>
        )}
        {slow && !unreachable && (
          <div
            className="banner"
            role="status"
            style={{ margin: 'var(--space-2) 0 var(--space-4)' }}
          >
            <Icon name="cloud-slash" />
            <span className="uf-1">{t.authSlowHint}</span>
          </div>
        )}

        {(wallView || personView) && (
          <LockerWall
            people={people.map((p) => ({ id: p.uid, name: p.name, avatar: p.avatar }))}
            activeId={pickedId ?? undefined}
            openId={person?.uid}
            openLabel={t.authLockerOpen}
            busyId={(bio || busy) && person ? person.uid : undefined}
            busyLabel={t.signingIn}
            label={t.authWallLabel}
            lockerLabel={(n, i) => t.authLockerLabel(n, i + 1)}
            onSelect={pick}
          />
        )}

        {formView && people.length > 0 && (
          <BackButton
            label={t.authSavedAccounts}
            size="lg"
            text={
              <>
                <span className="auth-back-stack" aria-hidden="true">
                  {people.slice(0, 3).map((p) => (
                    <Avatar key={p.uid} name={p.name} src={p.avatar} size={34} />
                  ))}
                </span>
              </>
            }
            onClick={() => {
              setPickedId(null);
              setError(null);
              setWall(true);
            }}
          />
        )}

        {formView && (
          <Field
            placeholder={t.username}
            value={identifier}
            autoComplete="username"
            disabled={unreachable || busy || locked}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        )}
        {personView && person && !bio && (
          /* kit-ok: names the account for the browser's password manager, so it offers this person's saved password only. */
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={person.login ?? ''}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="auth-username-hidden"
          />
        )}
        {!wallView && !bio && (
          <Field
            error={
              !locked && error ? (
                <>
                  <Icon name="warning-circle" /> {error}
                </>
              ) : undefined
            }
            type="password"
            placeholder={t.password}
            value={password}
            autoComplete="current-password"
            autoFocus={personView}
            disabled={unreachable || busy || locked}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {formView && (
          <label className="auth-remember">
            <Checkbox
              checked={remember}
              onChange={setRemember}
              disabled={unreachable || busy || locked}
            />
            <span className="uf-1">{t.authRememberMe}</span>
          </label>
        )}

        {locked ? (
          <div className="banner danger-ring">
            <Icon name="lock-simple" />
            <span className="uf-1">{t.tooManyAttempts}</span>
            <span className="num">{fmtSessionClock((lockUntil ?? now) - now)}</span>
          </div>
        ) : null}

        {!wallView && !bio && (
          <Button
            type="submit"
            variant="primary"
            className="fx-fs-15 ug-10 umt-8"
            style={{ minHeight: 48 }}
            disabled={busy || unreachable || locked}
          >
            {busy ? t.signingIn : t.signIn}
          </Button>
        )}

        {(wallView || personView) && (
          <Button
            variant="link"
            onClick={() => {
              setPickedId(null);
              setError(null);
              setWall(false);
            }}
          >
            {t.authUseAnother}
          </Button>
        )}

        {(unreachable || slow) && (
          <Button
            variant="secondary"
            className="fx-fs-13 ug-8"
            style={{ minHeight: 44 }}
            onClick={probe}
          >
            <Icon name="arrow-clockwise" />
            {t.retry}
          </Button>
        )}

        <InstallShortcut />

        <LegalLinks
          label={lg.ui.legalNav}
          privacyLabel={lg.ui.privacyLink}
          termsLabel={lg.ui.termsLink}
        />
      </div>
      <div className="auth-visual" aria-hidden />
    </form>
  );
}
