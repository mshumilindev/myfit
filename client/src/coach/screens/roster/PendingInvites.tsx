import { GroupedList } from '../../../components/ui/GroupedList';
import { IconButton } from '../../../components/ui/Button';
import { ClientRow } from '../../../components/ui/RosterRows';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { SafeStrings } from '../../../i18n/coachSafe';
import type { InviteResult } from '../../data/inviteStore';
import { daysLeft } from '../../domain/invite';
import type { RosterRow } from '../../domain/roster';
import type { LogMode } from '../../domain/types';
import { ClientAvatar } from '../../ClientAvatar';

export interface PendingInviteRow {
  id: string;
  withdrawable: boolean;
  name: string;
  detail: string;
  state: string;
  mode: LogMode;
}

/** Invites created in this session plus the roster's pending clients (expired and withdrawn handled). */
export function pendingInviteRows(o: {
  r: RosterStrings;
  now: number;
  created: readonly InviteResult[];
  pending: readonly RosterRow[];
  withdrawn: ReadonlySet<string>;
}): PendingInviteRow[] {
  return [
    ...o.created.map((c: InviteResult) => ({
      id: c.id,
      withdrawable: c.url != null,
      name: c.name,
      detail:
        c.url == null
          ? o.r.roProgramNoInvite
          : c.expiresAt != null
            ? o.r.roInviteLeft(daysLeft(c.expiresAt, c.sentAt))
            : o.r.roInviteSentJust,
      state: c.url == null ? o.r.roAdded : o.r.roPending,
      mode: c.mode,
    })),
    ...o.pending
      .filter((p) => !o.created.some((c) => c.id === p.client.id))
      .filter((p) => !o.withdrawn.has(p.client.id))
      .map((p) => {
        const left = p.client.invite ? daysLeft(p.client.invite.expiresAt, o.now) : 0;
        return {
          id: p.client.id,
          withdrawable: left > 0,
          name: p.client.name,
          detail: left > 0 ? o.r.roInviteLeft(left) : o.r.roInviteExpired,
          state: o.r.roPending,
          mode: p.client.mode,
        };
      }),
  ];
}

/** "Pending invites" group of the roster. */
export function PendingInvites(pp: {
  rows: readonly PendingInviteRow[];
  r: RosterStrings;
  sf: SafeStrings;
  onWithdraw: (w: { id: string; name: string }) => void;
  /** One button: withdraw this invite and send a fresh one (new link, new 7 days). */
  onResend: (w: { id: string; name: string; mode: LogMode }) => void;
}) {
  if (pp.rows.length === 0) return null;
  return (
    <div>
      <SectionLabel role="heading" aria-level={2}>
        {pp.r.roPendingH(pp.rows.length)}
      </SectionLabel>
      <GroupedList list>
        {pp.rows.map((p) => (
          <li key={p.id}>
            <ClientRow
              name={p.name}
              avatar={<ClientAvatar id={p.id} name={p.name} size={40} hasPhoto={false} />}
              program={p.detail}
              trailing={
                <>
                  <small>{p.state}</small>
                  {p.withdrawable && (
                    <IconButton
                      icon="arrow-clockwise"
                      size="sm"
                      variant="ghost"
                      label={pp.sf.invResendFor(p.name)}
                      onClick={() => pp.onResend({ id: p.id, name: p.name, mode: p.mode })}
                    />
                  )}
                  {p.withdrawable && (
                    <IconButton
                      icon="x"
                      size="sm"
                      variant="ghost"
                      label={pp.sf.invWithdrawFor(p.name)}
                      onClick={() => pp.onWithdraw({ id: p.id, name: p.name })}
                    />
                  )}
                </>
              }
            />
          </li>
        ))}
      </GroupedList>
    </div>
  );
}
