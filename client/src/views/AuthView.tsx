/** Auth — design S-01…S-06. Sign-in default, sign-up open to anyone. */
import { useEffect, useState, type FormEvent } from 'react';
import { HttpError, request, setAuth } from '../api';
import { fmtSessionClock, useT } from '../i18n';
import { Icon, LanguageSelector, Spinner } from '../ui';

type Mode = 'signin' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('signin');
  const [unreachable, setUnreachable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [identifier, setIdentifier] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
    firstName?: boolean;
    username?: boolean;
  }>({});

  function probe() {
    request<{ registered: boolean }>('GET', '/api/auth/status')
      .then((s) => {
        setUnreachable(false);
        if (!s.registered) setMode('signup');
      })
      .catch((err) => {
        // 4xx/5xx means the server answered; only network failure blocks auth.
        setUnreachable(!(err instanceof Error && 'status' in err));
      })
      .finally(() => setChecking(false));
  }
  useEffect(() => {
    probe();
  }, []);

  const emailBad = mode === 'signup' && touched.email && !EMAIL_RE.test(email.trim());
  const passwordBad = mode === 'signup' && touched.password && password.length < 6;
  const firstNameBad = mode === 'signup' && touched.firstName && firstName.trim().length < 2;
  const usernameBad = mode === 'signup' && touched.username && username.trim().length < 2;
  const signupInvalid =
    mode === 'signup' &&
    (!EMAIL_RE.test(email.trim()) ||
      password.length < 6 ||
      firstName.trim().length < 2 ||
      username.trim().length < 2);

  useEffect(() => {
    if (lockUntil === null) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [lockUntil]);
  const locked = lockUntil !== null && lockUntil > now;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || (mode === 'signup' && signupInvalid)) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === 'signup'
          ? await request<{
              token: string;
              username: string;
              name?: string;
              role?: 'member' | 'trainer' | 'admin';
            }>('POST', '/api/auth/register', {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              username: username.trim(),
              email: email.trim(),
              password,
            })
          : await request<{
              token: string;
              username: string;
              name?: string;
              role?: 'member' | 'trainer' | 'admin';
            }>('POST', '/api/auth/login', {
              identifier: identifier.trim(),
              password,
            });
      setAuth(res.token, res.name ?? res.username, res.role ?? 'member');
      onLoggedIn();
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) setError(t.wrongCredentials);
      else if (err instanceof HttpError && err.status === 429)
        setLockUntil(Date.now() + 15 * 60 * 1000);
      else setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-body" onSubmit={submit}>
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Icon name="barbell" className="wordmark" />
          <LanguageSelector />
        </div>
        <h2 className="auth-title">{mode === 'signin' ? t.appName : t.createYourAccount}</h2>
        {mode === 'signin' ? (
          <p className="auth-sub">{t.authTagline}</p>
        ) : (
          <div className="note-ok">
            <Icon name="shield-check" />
            <span>{t.signupNote}</span>
          </div>
        )}

        {unreachable && (
          <div className="banner danger-ring" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>
            <Icon name="cloud-slash" />
            <span>{t.serverUnreachable}</span>
          </div>
        )}

        {mode === 'signin' ? (
          <>
            <input
              className="input"
              placeholder={t.emailOrUsername}
              value={identifier}
              autoComplete="username"
              disabled={unreachable || busy || locked}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <input
              className={`input${error ? ' error' : ''}`}
              type="password"
              placeholder={t.password}
              value={password}
              autoComplete="current-password"
              disabled={unreachable || busy || locked}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        ) : (
          <>
            <input
              className={`input${firstNameBad ? ' error' : ''}`}
              placeholder={t.firstName}
              value={firstName}
              autoComplete="given-name"
              disabled={unreachable || busy || locked}
              onBlur={() => setTouched((x) => ({ ...x, firstName: true }))}
              onChange={(e) => setFirstName(e.target.value)}
            />
            {firstNameBad && (
              <div className="field-error">
                <Icon name="warning-circle" />
                {t.firstNameTooShort}
              </div>
            )}
            <input
              className="input"
              placeholder={t.lastName}
              value={lastName}
              autoComplete="family-name"
              disabled={unreachable || busy || locked}
              onChange={(e) => setLastName(e.target.value)}
            />
            <input
              className={`input${usernameBad ? ' error' : ''}`}
              placeholder={t.username}
              value={username}
              autoComplete="username"
              disabled={unreachable || busy || locked}
              onBlur={() => setTouched((x) => ({ ...x, username: true }))}
              onChange={(e) => setUsername(e.target.value)}
            />
            {usernameBad && (
              <div className="field-error">
                <Icon name="warning-circle" />
                {t.usernameTooShort}
              </div>
            )}
            <input
              className={`input${emailBad ? ' error' : ''}`}
              type="email"
              placeholder={t.email}
              value={email}
              autoComplete="email"
              disabled={unreachable || busy || locked}
              onBlur={() => setTouched((x) => ({ ...x, email: true }))}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailBad && (
              <div className="field-error">
                <Icon name="warning-circle" />
                {t.emailIncomplete}
              </div>
            )}
            <input
              className={`input${passwordBad ? ' error' : ''}`}
              type="password"
              placeholder={t.passwordMin}
              value={password}
              autoComplete="new-password"
              disabled={unreachable || busy || locked}
              onBlur={() => setTouched((x) => ({ ...x, password: true }))}
              onChange={(e) => setPassword(e.target.value)}
            />
            {passwordBad && (
              <div className="field-error">
                <Icon name="warning-circle" />
                {t.passwordTooShort}
              </div>
            )}
          </>
        )}

        {locked ? (
          <div className="banner danger-ring">
            <Icon name="lock-simple" />
            <span style={{ flex: 1 }}>{t.tooManyAttempts}</span>
            <span className="num">{fmtSessionClock((lockUntil ?? now) - now)}</span>
          </div>
        ) : (
          error && (
            <div className="field-error">
              <Icon name="warning-circle" />
              {error}
            </div>
          )
        )}

        <button
          className="btn btn-primary"
          style={{ minHeight: 48, fontSize: 15, marginTop: 'var(--space-3)', gap: 9 }}
          disabled={
            busy || checking || unreachable || locked || (mode === 'signup' && signupInvalid)
          }
        >
          {busy ? <Spinner onAccent /> : mode === 'signin' ? t.signIn : t.createAccount}
        </button>

        {unreachable && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 44, fontSize: 13, gap: 7 }}
            onClick={() => {
              setChecking(true);
              probe();
            }}
          >
            <Icon name="arrow-clockwise" />
            {t.retry}
          </button>
        )}

        <button
          type="button"
          className="footer-link"
          onClick={() => {
            setError(null);
            setMode(mode === 'signin' ? 'signup' : 'signin');
          }}
        >
          {mode === 'signin' ? t.newHereCreate : t.haveAccountSignIn}
        </button>
      </div>
      <div className="auth-visual" aria-hidden />
    </form>
  );
}
