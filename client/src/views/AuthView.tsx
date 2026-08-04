/** Auth — design S-01. Sign-in only; new accounts come via invite onboarding. */
import { useEffect, useState, type FormEvent } from 'react';
import { HttpError, callFn, signInWithPayload, type AuthPayload } from '../api';
import { fmtSessionClock, useT } from '../i18n';
import { Icon, LanguageSelector, Spinner } from '../ui';

export function AuthView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useT();
  const [unreachable, setUnreachable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  function probe() {
    callFn<{ registered: boolean }>('authStatus')
      .then(() => setUnreachable(false))
      .catch((err) => {
        // Only a genuine connectivity problem blocks auth; a function error
        // (project reachable) leaves the form usable.
        const status = err instanceof HttpError ? err.status : 0;
        setUnreachable(!navigator.onLine || status === 503);
      })
      .finally(() => setChecking(false));
  }
  useEffect(() => {
    probe();
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
        identifier: identifier.trim(),
        password,
      });
      await signInWithPayload(res);
      onLoggedIn();
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) setError(t.wrongCredentials);
      else if (err instanceof HttpError && err.status === 429)
        setLockUntil(Date.now() + 15 * 60 * 1000);
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Icon name="barbell" className="wordmark" />
          <LanguageSelector />
        </div>
        <h2 className="auth-title">{t.appName}</h2>
        <p className="auth-sub">{t.authTagline}</p>

        {unreachable && (
          <div className="banner danger-ring" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>
            <Icon name="cloud-slash" />
            <span>{t.serverUnreachable}</span>
          </div>
        )}

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
          disabled={busy || checking || unreachable || locked}
        >
          {busy ? <Spinner onAccent /> : t.signIn}
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

        <p className="footer-link" style={{ pointerEvents: 'none' }}>
          {t.newHereCreate}
        </p>
      </div>
      <div className="auth-visual" aria-hidden />
    </form>
  );
}
