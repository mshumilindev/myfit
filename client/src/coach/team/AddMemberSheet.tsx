import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { ResponsivePanel } from '../../components/ui/ResponsivePanel';
import { useTeamT } from '../../i18n/coachTeam';
import type { TeamErrorCode } from './port';
import { isEmail, type TeamRole } from './types';

/**
 * Add a manager (owner trainer) / Add a trainer (manager): ONE field, no role picker. The invite is one person, seven
 * days, and access starts when they accept. Board D14 / D14b.
 */
export function AddMemberSheet({
  role,
  onClose,
  onSend,
}: {
  /** the role the invitee gets */
  role: TeamRole;
  onClose: () => void;
  onSend: (
    email: string,
  ) => Promise<{ ok: true; url: string } | { ok: false; error: TeamErrorCode }>;
}) {
  const { tm } = useTeamT();
  const anchor = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const manager = role === 'manager';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    if (!isEmail(email)) {
      setError(tm.tmErrInvalidEmail);
      return;
    }
    setSending(true);
    const r = await onSend(email);
    setSending(false);
    if (r.ok) return setLink(r.url);
    setError(
      r.error === 'invalid-email'
        ? tm.tmErrInvalidEmail
        : r.error === 'exists'
          ? tm.tmErrExists
          : r.error === 'offline'
            ? tm.tmErrOffline
            : tm.tmErrGeneric,
    );
  };

  const copy = () => {
    if (!link) return;
    void navigator.clipboard?.writeText(link).catch(() => undefined);
    setCopied(true);
  };

  if (link)
    return (
      <ResponsivePanel
        open
        mode="sheet"
        anchorRef={anchor}
        onClose={onClose}
        label={tm.tmLinkTitle}
        title={tm.tmLinkTitle}
        footer={
          <div className="tm-sheet-actions">
            <Button variant="primary" icon={copied ? 'check' : undefined} onClick={copy}>
              {copied ? tm.tmLinkCopied : tm.tmCopyLink}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {tm.tmDone}
            </Button>
          </div>
        }
      >
        <div className="tm-sheet">
          <p className="tm-sheet-sub">{tm.tmLinkBody(email.trim())}</p>
          <Field
            label={tm.tmCopyLink}
            value={link}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      </ResponsivePanel>
    );

  return (
    <ResponsivePanel
      open
      mode="sheet"
      anchorRef={anchor}
      onClose={onClose}
      label={manager ? tm.tmAddManagerTitle : tm.tmAddTrainerTitle}
      title={manager ? tm.tmAddManagerTitle : tm.tmAddTrainerTitle}
      footer={
        <div className="tm-sheet-actions">
          <Button variant="primary" loading={sending} onClick={() => void submit()}>
            {tm.tmSendInvite}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {tm.tmCancel}
          </Button>
        </div>
      }
    >
      <form className="tm-sheet" onSubmit={(e) => void submit(e)} noValidate>
        <p className="tm-sheet-sub">{manager ? tm.tmAddManagerBody : tm.tmAddTrainerBody}</p>
        <Field
          label={tm.tmEmail}
          type="email"
          inputMode="email"
          autoComplete="off"
          autoFocus
          value={email}
          error={error}
          hint={tm.tmEmailHint}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
        />
      </form>
    </ResponsivePanel>
  );
}
