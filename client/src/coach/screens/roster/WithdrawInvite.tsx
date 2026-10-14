import { Button } from '../../../components/ui/Button';
import { ConfirmEffectsDialog } from '../../../components/ui/ConfirmEffectsDialog';
import { Notice } from '../../../components/ui/Notice';
import type { SafeStrings } from '../../../i18n/coachSafe';
import { firstName } from '../format';

/** Confirm withdrawing a pending invite, and the notice when the withdrawal failed. */
export function WithdrawInvite(p: {
  sf: SafeStrings;
  withdrawing: { id: string; name: string } | null;
  failed: boolean;
  onCancel: () => void;
  onConfirm: (w: { id: string; name: string }) => void;
  onDismissFailed: () => void;
}) {
  const { sf, withdrawing } = p;
  return (
    <>
      {withdrawing && (
        <ConfirmEffectsDialog
          title={sf.invWithdrawTitle(firstName(withdrawing.name))}
          icon="x"
          body={sf.invWithdrawBody}
          effects={[{ icon: 'link-break', text: sf.invWithdrawEffect }]}
          confirmLabel={sf.invWithdrawConfirm}
          cancelLabel={sf.raCancel}
          onCancel={p.onCancel}
          onConfirm={() => p.onConfirm(withdrawing)}
        />
      )}
      {p.failed && (
        <Notice
          tone="danger"
          icon="warning-circle"
          trail={
            <Button variant="ghost" size="sm" onClick={p.onDismissFailed}>
              {sf.raCancel}
            </Button>
          }
        >
          {sf.invWithdrawFailed}
        </Notice>
      )}
    </>
  );
}
