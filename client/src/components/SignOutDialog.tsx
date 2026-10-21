import { useState } from 'react';
import { readRemembered } from '../accounts/rememberedPeople';
import { currentUid } from '../api';
import { useT } from '../i18n';
import { ConfirmDialog } from './ui/Overlays';

/**
 * The one sign-out confirmation (profile page and every app's account block).
 * "Remember me on this device" starts ticked when this device lists the person; unticking it makes the device forget the
 * person at sign-out (`onConfirm(true)` = forget), so the landing no longer offers them.
 */
export function SignOutDialog({
  queueLength,
  onCancel,
  onConfirm,
}: {
  queueLength: number;
  onCancel: () => void;
  onConfirm: (forget: boolean) => void;
}) {
  const { t } = useT();
  const [remember, setRemember] = useState(() => {
    try {
      const uid = currentUid();
      return uid !== null && readRemembered(localStorage).some((p) => p.uid === uid);
    } catch {
      return false;
    }
  });
  return (
    <ConfirmDialog
      title={t.signOutTitle}
      body={queueLength > 0 ? t.signOutQueueBody(queueLength) : t.signOutCleanBody}
      confirmLabel={t.signOut}
      cancelLabel={t.cancel}
      danger
      checkbox={{ label: t.signOutRemember, checked: remember, onChange: setRemember }}
      fineprint={t.signOutForgetHint}
      onCancel={onCancel}
      onConfirm={() => onConfirm(!remember)}
    />
  );
}
