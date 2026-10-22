/**
 * "Sign out" and "Delete my account" under a blocking legal sheet (SPO-295 N12, N8): the only ways out without
 * accepting. Shared by the existing-user gate and the policy-update sheet: `buttons` go in the sheet's `.lgg-acts`, `dialogs`
 * beside the sheet. The hook owns the confirm state.
 */
import { useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useGateT } from '../i18n/legalGate';
import { useDeleteT } from '../i18n/accountDelete';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Overlays';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { LEGAL_WINDOW, rememberLegalReturn } from './route';

/** Opens a public legal page in a new tab (the gate stays where it is). */
export function openLegalPage(id: string): void {
  const url = `${window.location.pathname}${window.location.search}#/${id}`;
  const w = window.open(url, LEGAL_WINDOW);
  if (w) w.opener = null;
  else {
    rememberLegalReturn(); // same-tab fallback: Back returns to the screen the person came from (the coach, say)
    window.location.hash = `#/${id}`;
  }
}

export function useGateLeave(onSignOut: () => void): { buttons: ReactNode; dialogs: ReactNode } {
  const { t } = useT();
  const g = useGateT();
  const d = useDeleteT();
  const [confirmOut, setConfirmOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return {
    buttons: (
      <div className="lgg-leave">
        <Button variant="danger" size="sm" icon="sign-out" onClick={() => setConfirmOut(true)}>
          {t.signOut}
        </Button>
        <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleting(true)}>
          {d.deleteMyAccount}
        </Button>
      </div>
    ),
    // Rendered beside the Sheet, not inside it: a dialog must not sit in the sheet's own stacking context.
    dialogs: (
      <>
        {deleting && <DeleteAccountFlow onCancel={() => setDeleting(false)} />}
        {confirmOut && (
          <ConfirmDialog
            icon="sign-out"
            title={t.signOutTitle}
            body={g.signOutBody}
            confirmLabel={t.signOut}
            cancelLabel={t.stay}
            onConfirm={onSignOut}
            onCancel={() => setConfirmOut(false)}
          />
        )}
      </>
    ),
  };
}
