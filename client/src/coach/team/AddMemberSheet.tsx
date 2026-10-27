import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { ResponsivePanel } from '../../components/ui/ResponsivePanel';
import { useTeamT } from '../../i18n/coachTeam';
import { InviteLinkActions, InviteLinkBody, useCopyLink } from './InviteLinkPanel';
import type { TeamErrorCode } from './port';
import { isEmail, type TeamRole } from './types';

/**
 * Add a team member: an email and the type (Manager or Trainer, the sender picks). The invite is one person, seven
 * days, and access starts when they accept. Board D14 / D14b (the type picker follows the product owner's call).
 */
export function AddMemberSheet({
  defaultRole,
  onClose,
  onSend,
}: {
  /** the type the picker starts on */
  defaultRole: TeamRole;
  onClose: () => void;
  onSend: (
    email: string,
    role: TeamRole,
  ) => Promise<{ ok: true; url: string } | { ok: false; error: TeamErrorCode }>;
}) {
  const { tm } = useTeamT();
  const anchor = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const { copied, copy } = useCopyLink(link ?? '');
  const [role, setRole] = useState<TeamRole>(defaultRole);
  const manager = role === 'manager';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    if (email.trim() && !isEmail(email)) {
      setError(tm.tmErrInvalidEmail);
      return;
    }
    setSending(true);
    const r = await onSend(email, role);
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

  if (link)
    return (
      <ResponsivePanel
        open
        mode="sheet"
        anchorRef={anchor}
        onClose={onClose}
        label={tm.tmLinkTitle}
        title={tm.tmLinkTitle}
        footer={<InviteLinkActions copied={copied} onCopy={copy} onClose={onClose} />}
      >
        <InviteLinkBody body={tm.tmLinkBody(email.trim())} link={link} />
      </ResponsivePanel>
    );

  return (
    <ResponsivePanel
      open
      mode="sheet"
      anchorRef={anchor}
      onClose={onClose}
      label={tm.tmAddMember}
      title={tm.tmAddMember}
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
        <Segmented<TeamRole>
          label={tm.tmRoleLabel}
          fill
          value={role}
          onChange={setRole}
          options={[
            { value: 'manager', label: tm.tmRoleManager },
            { value: 'trainer', label: tm.tmRoleTrainer },
          ]}
        />
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
