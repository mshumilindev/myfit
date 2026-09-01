import { useState, type FormEvent } from 'react';
import { AuthError, login } from './auth';
import { LanguageChip } from './components';
import { useT } from './i18n';

export function AuthView() {
  const { t } = useT();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
      // The store's onAuthChange listener flips the app to the tabs.
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) setError(t('wrongCredentials'));
      else if (err instanceof AuthError && err.status === 429) setError(t('tooManyAttempts'));
      else setError(err instanceof Error ? err.message : t('wrongCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <LanguageChip />
        </div>
        <div className="mark">🥗</div>
        <h2>{t('appName')}</h2>
        <p className="sub">{t('authSub')}</p>
        <input
          className="input"
          placeholder={t('emailOrUsername')}
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={busy}
        />
        <input
          className={`input${error ? ' error' : ''}`}
          type="password"
          placeholder={t('password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        {error && <div className="field-error">{error}</div>}
        <button className="btn acc block" type="submit" disabled={busy || !identifier || !password}>
          {busy ? t('loadingLabel') : t('signIn')}
        </button>
        <p className="muted mt4" style={{ fontSize: 12 }}>
          🔗 {t('oneAccount')}
        </p>
      </form>
    </div>
  );
}
