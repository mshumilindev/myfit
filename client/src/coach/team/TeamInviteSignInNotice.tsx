import { useEffect, useState } from 'react';
import { callFn } from '../../api';
import { Notice } from '../../components/ui/Notice';
import { useTeamT } from '../../i18n/coachTeam';

type Role = 'manager' | 'trainer';

/**
 * Sign-in screen note for a team link (`#/team-invite/<token>`, SPO-284): a person with no session sees who invited
 * them and in what role (the server's public preview: role and inviter name only), and what to do when they have no
 * account yet. Spotter has no self-sign-up, so the link never creates an account. A closed or unreadable link shows
 * nothing here; the Join page explains it after sign-in.
 */
export function TeamInviteSignInNotice({ token }: { token: string }) {
  const [info, setInfo] = useState<{ role: Role; invitedByName: string } | null>(null);
  useEffect(() => {
    let live = true;
    callFn<{ role: Role; invitedByName: string }>('teamInvitePublic', { inviteId: token })
      .then((r) => live && setInfo(r))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [token]);
  return info ? <TeamInviteSignInNote role={info.role} invitedByName={info.invitedByName} /> : null;
}

/** The two notices themselves (no data access), so a story can show them. */
export function TeamInviteSignInNote({
  role,
  invitedByName,
}: {
  role: Role;
  invitedByName: string;
}) {
  const { tm } = useTeamT();
  return (
    <>
      <Notice tone="coach" icon="users">
        {role === 'trainer'
          ? tm.jtSignInTrainer(invitedByName || tm.jtSomeone)
          : tm.jtSignInManager(invitedByName || tm.jtSomeone)}
      </Notice>
      <Notice tone="neutral" icon="info">
        {tm.jtNoAccount}
      </Notice>
    </>
  );
}
