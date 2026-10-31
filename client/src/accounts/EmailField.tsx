import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Tag } from '../components/ui/Tag';
import { useEmailT } from '../i18n/emailAuth';
import {
  attachEmail,
  emailErrorKind,
  refreshEmailState,
  sendConfirmation,
  type EmailErrorKind,
  type EmailState,
} from './emailApi';
import { looksLikeEmail } from './emailFormat';

type Mode = 'view' | 'edit';

/**
 * The Email field of the profile form (SPO-283): three states from the server (none / not confirmed / confirmed).
 * Linking or changing asks for the current password; the letter is sent by Firebase and the account signs in with the
 * address only after it is confirmed.
 */
export function EmailField() {
  const t = useEmailT();
  const [state, setState] = useState<EmailState | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EmailErrorKind | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await refreshEmailState());
      setError(null);
    } catch (e) {
      setError(emailErrorKind(e));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the server state once on mount
    void load();
  }, [load]);

  const linked = !!state?.email;
  const editing = mode === 'edit' || (state !== null && !linked);
  const canSave = looksLikeEmail(draft) && password.length > 0 && !busy;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(emailErrorKind(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const next = await attachEmail(draft.trim(), password);
      setState(next);
      setMode('view');
      setDraft('');
      setPassword('');
      await sendConfirmation();
      setNote(t.resendSent);
    });
  const resend = () =>
    run(async () => {
      await sendConfirmation();
      setNote(t.resendSent);
    });
  const check = () =>
    run(async () => {
      const next = await refreshEmailState();
      setState(next);
      if (!next.verified) setNote(t.stillPending);
    });

  const status =
    linked && !editing ? (
      <Tag tone={state?.verified ? 'ok' : 'danger'}>
        {state?.verified ? t.statusVerified : t.statusPending}
      </Tag>
    ) : undefined;
  const hint = editing
    ? t.hintNone
    : state?.verified
      ? t.hintVerified
      : state?.email
        ? t.hintPending(state.email)
        : undefined;

  return (
    <>
      <Field
        label={t.fieldLabel}
        type="email"
        autoComplete="email"
        placeholder={t.fieldPlaceholder}
        value={editing ? draft : (state?.email ?? '')}
        readOnly={!editing}
        disabled={state === null && error === null}
        onChange={(e) => setDraft(e.currentTarget.value)}
        trail={status}
        hint={note ?? hint}
        error={error ? t.errors[error] : undefined}
      />
      {editing && draft.length > 0 && (
        <Field
          label={t.passwordLabel}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          hint={t.passwordHint}
        />
      )}
      <div className="profile-edit-actions inline">
        {editing && draft.length > 0 && (
          <>
            {linked && (
              <Button
                variant="secondary"
                onClick={() => {
                  setMode('view');
                  setDraft('');
                  setPassword('');
                }}
                disabled={busy}
              >
                {t.cancel}
              </Button>
            )}
            <Button variant="primary" onClick={save} disabled={!canSave}>
              {t.save}
            </Button>
          </>
        )}
        {!editing && linked && !state?.verified && (
          <>
            <Button variant="secondary" onClick={resend} disabled={busy}>
              {t.resend}
            </Button>
            <Button variant="secondary" onClick={check} disabled={busy}>
              {t.checkNow}
            </Button>
          </>
        )}
        {!editing && linked && (
          <Button variant="ghost" onClick={() => setMode('edit')} disabled={busy}>
            {t.change}
          </Button>
        )}
      </div>
    </>
  );
}
