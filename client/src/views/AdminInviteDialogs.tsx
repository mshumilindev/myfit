import { useState } from 'react';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { ListRow } from '../components/ui/GroupedList';
import { callFn } from '../api';
import { fmtDayMonth, useT } from '../i18n';
import { fullPersonName } from '../name';
import { looksLikeEmail } from '../accounts/emailFormat';
import { Icon, Sheet } from '../ui';
import { UserAvatar } from '../components/Avatar';
import { PersonFields } from './AdminPersonFields';
import { inviteLink, type MailOutcome, type Person } from './adminTypes';

export function NewPersonDialog(props: {
  kind: 'member' | 'trainer';
  trainers: Person[];
  onClose: () => void;
  onCreated: (
    p: Person,
    token: string,
    expiresAt: number,
    mail: MailOutcome,
    email: string,
  ) => void;
}) {
  const { t, locale } = useT();
  const [role, setRole] = useState<Person['role']>(props.kind);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.adminNewMember}</span>
      </div>
      <Field
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder={t.adminInviteEmail}
        hint={t.adminInviteEmailHint}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PersonFields
        firstName={firstName}
        lastName={lastName}
        username={username}
        onFirstName={setFirstName}
        onLastName={setLastName}
        onUsername={setUsername}
      />
      <div className="admin-role-field">
        <div className="field-label">{t.adminColRole}</div>
        <div className="admin-role-options">
          {(
            [
              ['member', t.roleMember, t.adminMemberRoleHint, 'user'],
              ['trainer', t.roleTrainer, t.adminTrainerRoleHint, 'user-focus'],
              ['admin', t.roleAdmin, t.adminAdminRoleHint, 'shield-check'],
            ] as Array<[Person['role'], string, string, Parameters<typeof Icon>[0]['name']]>
          ).map(([id, label, hint, icon]) => (
            <ListRow
              key={id}
              icon={<Icon name={icon} />}
              label={label}
              sub={hint}
              selected={role === id}
              check={role === id}
              onClick={() => setRole(id)}
            />
          ))}
        </div>
      </div>
      {props.trainers.length > 0 && (
        <div className="assign-list">
          <div className="field-label">{t.adminAssignedTrainer}</div>
          <ListRow
            label={t.adminNoTrainer}
            sub={t.adminNoTrainerNote}
            selected={trainerId === null}
            check={trainerId === null}
            onClick={() => setTrainerId(null)}
          />
          {props.trainers.map((tr) => (
            <ListRow
              key={tr.id}
              icon={<UserAvatar userId={tr.id} name={tr.name} hasPhoto={tr.avatar} size={34} />}
              label={tr.name}
              sub={t.adminClients(tr.clientCount)}
              selected={trainerId === tr.id}
              check={trainerId === tr.id}
              onClick={() => setTrainerId(tr.id)}
            />
          ))}
        </div>
      )}
      {error && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {error}
        </div>
      )}
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={busy || !looksLikeEmail(email)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await callFn<{
                person: Person;
                invite: { token: string; expiresAt: number };
                mail: MailOutcome;
              }>('adminCreateUser', {
                email: email.trim(),
                locale,
                name: fullPersonName(firstName, lastName),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                username: username.trim(),
                trainerId,
                role,
              });
              props.onCreated(r.person, r.invite.token, r.invite.expiresAt, r.mail, email.trim());
            } catch (e) {
              setError(e instanceof Error ? e.message : t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.save}
        </Button>
      </div>
    </Sheet>
  );
}

/** AD-02: link + QR in the same dialog the account was created in. */
export function LinkDialog(props: {
  person: Person;
  token: string;
  expiresAt: number;
  mail?: MailOutcome;
  email?: string;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const url = inviteLink(props.token);
  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t ut-ok">
          <Icon name="check-circle" weight="fill" /> {t.adminCreated}
        </span>
      </div>
      <div className="h1">{t.adminReadyToClaim(props.person.name)}</div>
      {props.mail && (
        <div className={props.mail.sent ? 'info-row' : 'field-error'}>
          <Icon name={props.mail.sent ? 'envelope' : 'warning-circle'} />
          {props.mail.sent ? t.adminMailSent(props.email ?? '') : t.adminMailFailed}
        </div>
      )}
      <p className="detail-muted">{t.adminSendLink}</p>
      <div className="field-label">{t.adminInviteLink}</div>
      <div className="invite-link-line">
        <div className="invite-link-row">
          <Icon name="arrow-up-right" />
          <code>{url.replace(/^https?:\/\//, '')}</code>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          <Icon name="copy" /> {copied ? t.adminCopied : t.adminCopy}
        </Button>
        <Button variant="secondary" onClick={() => setShowQr((x) => !x)}>
          <Icon name="qr-code" />
          {t.adminQr}
        </Button>
      </div>
      {showQr && (
        <img
          className="invite-qr"
          alt="QR"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=1f2125&color=e9eaec&data=${encodeURIComponent(url)}`}
        />
      )}
      <div className="invite-cells">
        <div className="cell">
          <div className="l">{t.adminExpiresLabel}</div>
          <div className="v">{t.adminExpires(fmtDayMonth(props.expiresAt, locale))}</div>
        </div>
        <div className="cell">
          <div className="l">{t.adminUsesLabel}</div>
          <div className="v">{t.adminSingleUse}</div>
        </div>
        <div className="cell">
          <div className="l">{t.adminAssignedTrainer}</div>
          <div className="v">{props.person.trainerName ?? t.adminNoTrainer}</div>
        </div>
      </div>
      <div className="info-row">
        <Icon name="info" />
        <span>{t.adminLinkNote}</span>
      </div>
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.adminCreateAnother}
        </Button>
        <Button variant="primary" className="grow" onClick={props.onClose}>
          {t.adminDone}
        </Button>
      </div>
    </Sheet>
  );
}

/** Fixes the address of an unclaimed invitation and sends the letter again. */
export function ChangeEmailDialog(props: {
  person: Person;
  onClose: () => void;
  onDone: (
    r: { invite: { token: string; expiresAt: number }; mail: MailOutcome },
    email: string,
  ) => void;
}) {
  const { t, locale } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.adminChangeEmail}</span>
      </div>
      <Field
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder={t.adminInviteEmail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {error}
        </div>
      )}
      <div className="sheet-actions">
        <Button variant="secondary" className="grow" onClick={props.onClose}>
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          className="grow"
          disabled={busy || !looksLikeEmail(email)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await callFn<{
                invite: { token: string; expiresAt: number };
                mail: MailOutcome;
              }>('adminChangeInviteEmail', { id: props.person.id, email: email.trim(), locale });
              props.onDone(r, email.trim());
            } catch (e) {
              setError(e instanceof Error ? e.message : t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.save}
        </Button>
      </div>
    </Sheet>
  );
}
