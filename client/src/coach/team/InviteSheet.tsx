import { useRef, useState } from 'react';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { ResponsivePanel } from '../../components/ui/ResponsivePanel';
import { useTeamT } from '../../i18n/coachTeam';
import type { TeamInvite } from './types';

/**
 * A pending invite on a phone: tap the row, copy the link or withdraw it (the desktop row keeps both inline, board
 * D12; the phone board shows only the "Pending" tag, so the two actions live behind the tap).
 */
export function InviteSheet({
  invite,
  onClose,
  onRevoke,
}: {
  invite: TeamInvite;
  onClose: () => void;
  onRevoke: () => void;
}) {
  const { tm } = useTeamT();
  const anchor = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <ResponsivePanel
      open
      mode="sheet"
      anchorRef={anchor}
      onClose={onClose}
      label={invite.email || tm.tmInviteLinkRow}
      title={invite.email || tm.tmInviteLinkRow}
    >
      <div className="tm-sheet">
        <GroupedList surface="raised">
          {invite.url ? (
            <ListRow
              label={copied ? tm.tmLinkCopied : tm.tmCopyLink}
              onClick={() => {
                void navigator.clipboard?.writeText(invite.url ?? '').catch(() => undefined);
                setCopied(true);
              }}
            />
          ) : null}
          <ListRow
            action
            tone="danger"
            label={tm.tmRevokeFor(invite.email || tm.tmInviteLinkRow)}
            onClick={() => {
              onRevoke();
              onClose();
            }}
          />
        </GroupedList>
      </div>
    </ResponsivePanel>
  );
}
