import { SecurityCode } from '../../components/ui/SecurityCode';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { Notice } from '../../components/ui/Notice';
import { useSafeT } from '../../i18n/coachSafe';
import type { SecurityState } from './useSecurity';

/**
 * The "Security code" dialog (centred glass dialog from the Coach breakpoint up, bottom sheet on a phone). `side`
 * decides the wording: the trainer reads their own code OUT to the client, the client compares it WITH the trainer.
 * No code yet (key not signed / chat not set up) is said calmly, never faked.
 */
export function SecurityCodeDialog({
  security,
  side,
  name,
  onClose,
}: {
  security: Pick<
    SecurityState,
    'code' | 'verified' | 'changed' | 'loading' | 'verify' | 'unverify'
  >;
  side: 'trainer' | 'client';
  /** The other person's first name. */
  name: string;
  onClose: () => void;
}) {
  const { sf } = useSafeT();
  const { code, verified, changed } = security;
  return (
    <ConfirmEffectsDialog
      title={sf.scTitle}
      icon="shield-check"
      iconTone="accent"
      body={side === 'trainer' ? sf.scIntroTrainer(name) : sf.scIntroClient(name)}
      cancelLabel={sf.scClose}
      cancelVariant="secondary"
      initialFocus="cancel"
      onCancel={onClose}
    >
      {code ? (
        <>
          {changed && (
            <Notice tone="injury" icon="warning-circle">
              {sf.scChangedBody(name)}
            </Notice>
          )}
          <SecurityCode
            code={code}
            verified={verified}
            onVerify={security.verify}
            onUnverify={security.unverify}
            labels={{
              groupsAria: sf.scGroupsAria,
              copy: sf.scCopy,
              copied: sf.scCopied,
              verified: sf.scVerified,
              notVerified: sf.scNotVerified,
              verify: sf.scVerify,
              unverify: sf.scUnverify,
            }}
          />
        </>
      ) : (
        <Notice tone="neutral" icon="lock-simple">
          {security.loading ? sf.scLoading : sf.scNoKey}
        </Notice>
      )}
    </ConfirmEffectsDialog>
  );
}
