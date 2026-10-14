import { useRef, useState, type ReactNode } from 'react';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { Field } from '../../components/ui/Field';
import { useSafeT } from '../../i18n/coachSafe';
import {
  getReauthPort,
  markReauthed,
  type ReauthAction,
  type ReauthPort,
  type ReauthResult,
} from './reauth';

/** Password prompt on the kit ConfirmEffectsDialog (glass dialog, phone sheet). It guards one action; Cancel just closes. */
export function ReauthDialog({
  action,
  port = getReauthPort(),
  onDone,
  onCancel,
}: {
  action?: ReauthAction;
  port?: ReauthPort;
  onDone: () => void;
  /** close without doing anything */
  onCancel: () => void;
}) {
  const { sf } = useSafeT();
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState<ReauthResult | null>(null);
  const [busy, setBusy] = useState(false);
  const needId = !port.knowsIdentifier();
  const tries = useRef(0);

  const submit = async () => {
    if (busy || !password) return;
    setBusy(true);
    setResult(null);
    tries.current += 1;
    const r = await port
      .check({ password, identifier: needId ? identifier : undefined })
      .catch((): ReauthResult => 'error');
    setBusy(false);
    if (r === 'ok') {
      markReauthed();
      setPassword('');
      onDone();
    } else {
      setResult(r);
      setPassword('');
    }
  };

  const error: ReactNode = result
    ? result === 'wrong'
      ? sf.raWrong
      : result === 'locked'
        ? sf.raLocked
        : result === 'offline'
          ? sf.raOffline
          : sf.raError
    : undefined;
  const body =
    action === 'end'
      ? sf.raBodyEnd
      : action === 'revoke-invite'
        ? sf.raBodyRevoke
        : sf.raBodyExport;
  return (
    <ConfirmEffectsDialog
      title={sf.raTitle}
      icon={'shield-check'}
      iconTone="accent"
      body={body}
      confirmLabel={sf.raConfirm}
      confirmVariant="primary"
      cancelLabel={sf.raCancel}
      cancelVariant="secondary"
      initialFocus="confirm"
      dismissable
      loading={busy}
      onConfirm={() => void submit()}
      onCancel={onCancel}
    >
      <div
        className="reauth-fields"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      >
        {needId && (
          <Field
            label={sf.raIdentifier}
            value={identifier}
            autoComplete="username"
            autoCapitalize="none"
            onChange={(e) => setIdentifier(e.target.value)}
          />
        )}
        <Field
          label={sf.raPassword}
          type="password"
          value={password}
          autoComplete="current-password"
          autoFocus
          error={error}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </ConfirmEffectsDialog>
  );
}
