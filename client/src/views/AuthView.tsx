/** Auth — design S-01. Sign-in only; new accounts come via invite onboarding. */
import { useEffect, useState, type FormEvent } from 'react';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { HttpError, callFn, signInWithPayload, type AuthPayload } from '../api';
import { SpotterMark } from '../brand/SpotterMark';
import { fmtSessionClock, useT } from '../i18n';
import { Icon, LanguageSelector } from '../ui';
import { InstallShortcut } from './InstallShortcut';

/** The reachability probe gives up after this long; sign-in is never held back by it. */
const PROBE_TIMEOUT_MS = 6_000;

export function AuthView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useT();
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
        <div className="auth-lang">
          <LanguageSelector />
        </div>
        <SpotterMark size={88} variant="tight" className="wordmark" />
        <h2 className="auth-title">{t.appName}</h2>
        <p className="auth-sub">{t.authTagline}</p>

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

        <Field
          placeholder={t.username}
          value={identifier}
          autoComplete="username"
          disabled={unreachable || busy || locked}
          onChange={(e) => setIdentifier(e.target.value)}
        />
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
          disabled={unreachable || busy || locked}
          onChange={(e) => setPassword(e.target.value)}
        />

        {locked ? (
          <div className="banner danger-ring">
            <Icon name="lock-simple" />
            <span className="uf-1">{t.tooManyAttempts}</span>
            <span className="num">{fmtSessionClock((lockUntil ?? now) - now)}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="fx-fs-15 ug-10 umt-8"
          style={{ minHeight: 48 }}
          disabled={busy || unreachable || locked}
        >
          {busy ? t.signingIn : t.signIn}
        </Button>

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

        <p className="footer-link" style={{ pointerEvents: 'none' }}>
          {t.newHereCreate}
        </p>
      </div>
      <div className="auth-visual" aria-hidden />
    </form>
  );
}
