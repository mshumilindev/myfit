/** The reset link (SPO-225): a new password, "password changed", or a dead link. Opens from `#/join/<token>` of kind `reset`. */
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { resetErrorKind, setNewPassword } from '../accounts/passwordResetApi';
import { useResetT } from '../i18n/passwordReset';
import { Icon } from '../ui';
import { AuthShell } from './AuthShell';

const MIN = 6;
const MAX = 72;

export function ResetPasswordView({
  token,
  live,
  onSignIn,
  onNewLink,
}: {
  token: string;
  /** The link is still usable (the server said so when the page opened). */
  live: boolean;
  /** Go to the sign-in form. */
  onSignIn: () => void;
  /** Go to the "forgot your password" form for a fresh link. */
  onNewLink: () => void;
}) {
  const r = useResetT();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'new' | 'dead' | 'done'>(live ? 'new' : 'dead');

  async function save() {
    if (busy) return;
    if (password.length < MIN || password.length > MAX) {
      setError(r.passwordHint);
      return;
    }
    if (password !== again) {
      setError(r.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(token, password);
      setState('done');
    } catch (e) {
      const kind = resetErrorKind(e, 'save');
      if (kind === 'dead') setState('dead');
      else setError(r.errors[kind === 'invalid' ? 'generic' : kind]);
    } finally {
      setBusy(false);
    }
  }

  if (state === 'dead') {
    return (
      <AuthShell title={r.deadTitle} lead={r.deadLead}>
        <Notice tone="danger" icon="warning-circle">
          {r.deadNote}
        </Notice>
        <Button type="button" variant="primary" onClick={onNewLink}>
          {r.getNewLink}
        </Button>
        <Button type="button" variant="link" onClick={onSignIn}>
          {r.backToSignIn}
        </Button>
      </AuthShell>
    );
  }
  if (state === 'done') {
    return (
      <AuthShell title={r.doneTitle} lead={r.doneLead}>
        <Notice tone="ok" icon="check-circle">
          {r.doneNote}
        </Notice>
        <Button type="button" variant="primary" onClick={onSignIn}>
          {r.signIn}
        </Button>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={r.newTitle} lead={r.newLead} onSubmit={() => void save()}>
      <Field
        type="password"
        autoComplete="new-password"
        placeholder={r.newPassword}
        hint={r.passwordHint}
        value={password}
        autoFocus
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        type="password"
        autoComplete="new-password"
        placeholder={r.repeatPassword}
        value={again}
        error={
          error ? (
            <>
              <Icon name="warning-circle" /> {error}
            </>
          ) : undefined
        }
        onChange={(e) => setAgain(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? r.saving : r.save}
      </Button>
    </AuthShell>
  );
}
