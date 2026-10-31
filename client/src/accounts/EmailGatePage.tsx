/**
 * The email gate page (SPO-423, design SPO-223): one kit `FullPage` like the legal gate. "Add your email" (email + the
 * current password, which the server wants before the sign-in method changes) or "Check your inbox" (confirm, send
 * again with a cooldown, use another address). Presentational: the calls live in `EmailGate`.
 */
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { FullPage } from '../components/ui/FullPage';
import { IconTile } from '../components/ui/IconTile';
import { Notice } from '../components/ui/Notice';
import { useEmailT } from '../i18n/emailAuth';
import { useGateLeave } from '../legal/GateLeaveActions';
import '../legal/LegalGate.css';
import type { EmailErrorKind } from './emailApi';
import { looksLikeEmail } from './emailFormat';

export interface EmailGatePageProps {
  view: 'add' | 'sent';
  /** The linked address (view `sent`). */
  email: string | null;
  busy: boolean;
  error: EmailErrorKind | null;
  /** A note under the form, e.g. "link sent". */
  note: string | null;
  /** Seconds before "send again" works. */
  cooldown: number;
  onSend: (email: string, password: string) => void;
  onResend: () => void;
  onCheck: () => void;
  /** Back from `sent` to the form (another address). */
  onChangeAddress: () => void;
  onSignOut: () => void;
}

export function EmailGatePage(p: EmailGatePageProps) {
  const t = useEmailT();
  const leave = useGateLeave(p.onSignOut);
  const [draft, setDraft] = useState('');
  const [password, setPassword] = useState('');
  const adding = p.view === 'add';
  const title = adding ? t.gateAddTitle : t.gateCheckTitle(p.email ?? '');
  const canSend = looksLikeEmail(draft) && password.length > 0 && !p.busy;
  return (
    <FullPage
      label={title}
      aside={leave.dialogs}
      actions={
        <div className="uifp-row">
          {adding ? (
            <Button
              variant="primary"
              size="lg"
              disabled={!canSend}
              onClick={() => p.onSend(draft, password)}
            >
              {t.gateAddAction}
            </Button>
          ) : (
            <Button variant="primary" size="lg" disabled={p.busy} onClick={p.onCheck}>
              {t.checkNow}
            </Button>
          )}
        </div>
      }
    >
      <div className="lgg">
        <div className="lgg-head">
          <IconTile tone="accent" size={44} icon="shield-check" />
          <h2 className="lgg-t ut-xl ut-w7">{title}</h2>
        </div>
        <p className="lgg-lead ut-base ut-muted">{adding ? t.gateAddLead : t.gateCheckLead}</p>
        {adding && (
          <>
            <Field
              label={t.fieldLabel}
              type="email"
              autoComplete="email"
              placeholder={t.fieldPlaceholder}
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              error={p.error && p.error !== 'password' ? t.errors[p.error] : undefined}
            />
            <Field
              label={t.passwordLabel}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              hint={t.passwordHint}
              error={p.error === 'password' ? t.errors.password : undefined}
            />
          </>
        )}
        {!adding && (
          <>
            {p.error && (
              <Notice tone="danger" icon="warning-circle">
                {t.errors[p.error]}
              </Notice>
            )}
            {p.note && !p.error && (
              <Notice tone="neutral" icon="info" role="status">
                {p.note}
              </Notice>
            )}
            <div className="lgg-acts">
              <Button
                variant="secondary"
                size="md"
                disabled={p.busy || p.cooldown > 0}
                onClick={p.onResend}
              >
                {p.cooldown > 0 ? t.resendIn(p.cooldown) : t.resend}
              </Button>
              <Button variant="ghost" size="md" disabled={p.busy} onClick={p.onChangeAddress}>
                {t.gateChange}
              </Button>
            </div>
          </>
        )}
        <p className="lgg-lead ut-sm ut-muted">{t.gateNoMailbox}</p>
        {leave.buttons}
      </div>
    </FullPage>
  );
}
