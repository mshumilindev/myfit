/** Forgot password (SPO-225): the address, then "Check your inbox". Same answer for every address (no enumeration). */
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { looksLikeEmail } from '../accounts/emailFormat';
import { requestPasswordReset, resetErrorKind } from '../accounts/passwordResetApi';
import { useResetT } from '../i18n/passwordReset';
import { Icon } from '../ui';
import { AuthShell } from './AuthShell';

/** The pause before a second letter can be asked for (the server holds the same minute). */
const AGAIN_MS = 60_000;

export function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const r = useResetT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sentAt === null) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [sentAt]);
  const left = sentAt === null ? 0 : Math.max(0, Math.ceil((sentAt + AGAIN_MS - now) / 1000));

  async function send() {
    if (busy) return;
    if (!looksLikeEmail(email)) {
      setError(r.errors.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSentAt(Date.now());
      setNow(Date.now());
    } catch (e) {
      const kind = resetErrorKind(e, 'request');
      setError(
        kind === 'invalid' ? r.errors.invalid : r.errors[kind === 'dead' ? 'generic' : kind],
      );
    } finally {
      setBusy(false);
    }
  }

  const sent = sentAt !== null;
  return (
    <AuthShell
      title={sent ? r.sentTitle : r.requestTitle}
      lead={sent ? r.sentLead : r.requestLead}
      onSubmit={() => void send()}
    >
      <Field
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={r.emailPlaceholder}
        value={email}
        readOnly={sent}
        autoFocus
        error={
          error ? (
            <>
              <Icon name="warning-circle" /> {error}
            </>
          ) : undefined
        }
        onChange={(e) => setEmail(e.target.value)}
      />
      {sent && (
        <Notice tone="ok" icon="check-circle">
          {r.sentTitle}
        </Notice>
      )}
      <Button
        type="submit"
        variant={sent ? 'secondary' : 'primary'}
        disabled={busy || (sent && left > 0)}
      >
        {busy ? r.sending : sent ? (left > 0 ? r.sendAgainIn(left) : r.sendAgain) : r.sendLink}
      </Button>
      <Button type="button" variant="link" onClick={onBack}>
        {r.backToSignIn}
      </Button>
    </AuthShell>
  );
}
