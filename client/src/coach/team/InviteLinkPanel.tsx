import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { useTeamT } from '../../i18n/coachTeam';

/**
 * The result step of the invite sheets ("Add member", "Invite client"): the link to copy. Pieces only, not a panel of its
 * own: each sheet keeps its single `ResponsivePanel`, so going from the form to the link does not remount (and re-slide) it.
 */
export function useCopyLink(link: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: () => {
      void navigator.clipboard?.writeText(link).catch(() => undefined);
      setCopied(true);
    },
  };
}

export function InviteLinkActions({
  copied,
  onCopy,
  onClose,
}: {
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { tm } = useTeamT();
  return (
    <div className="tm-sheet-actions">
      <Button variant="primary" icon={copied ? 'check' : undefined} onClick={onCopy}>
        {copied ? tm.tmLinkCopied : tm.tmCopyLink}
      </Button>
      <Button variant="secondary" onClick={onClose}>
        {tm.tmDone}
      </Button>
    </div>
  );
}

export function InviteLinkBody({ body, link }: { body: ReactNode; link: string }) {
  const { tm } = useTeamT();
  return (
    <div className="tm-sheet">
      <p className="tm-sheet-sub">{body}</p>
      <Field
        label={tm.tmCopyLink}
        value={link}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}
