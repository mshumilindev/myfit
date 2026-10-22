import { useCallback, useEffect, useState } from 'react';
import { fmtDayMonth } from '../../i18n';
import { useTeamT } from '../../i18n/coachTeam';
import { LandingView } from '../../views/landing/LandingView';
import { firstName } from '../screens/format';
import { TeamPortError, type InvitePreview, type TeamPort } from './port';
import { getTeamPort } from './useTeam';

type Phase =
  | { k: 'loading' }
  | { k: 'offline' }
  | { k: 'closed' }
  | { k: 'landing'; inv: InvitePreview }
  | { k: 'joined' }
  | { k: 'declined' };

/**
 * "Join the team" (`#/team-invite/<token>`, board D16), drawn INSIDE the landing: the hero card of the approved v36
 * design carries the invite (who invited you, what the role can see, Join / Decline). Nothing is written before the
 * person taps Join or Decline. A closed link, offline and the result are the same card with other lines, never a
 * spinner page. The copy is gender-neutral (the inviter's name, not "she / he").
 */
export function JoinTeamPage({
  token,
  port,
  onExit,
}: {
  token: string;
  port?: TeamPort;
  onExit: () => void;
}) {
  const { tm, locale } = useTeamT();
  const p = port ?? getTeamPort();
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    p.previewInvite(token)
      .then((inv) => setPhase({ k: 'landing', inv }))
      .catch((e) =>
        setPhase(
          e instanceof TeamPortError && (e.code === 'closed' || e.code === 'not-found')
            ? { k: 'closed' }
            : { k: 'offline' },
        ),
      );
  }, [p, token]);
  useEffect(load, [load]);

  const act = (fn: () => Promise<void>, next: Phase) => {
    setBusy(true);
    setError(null);
    fn()
      .then(() => setPhase(next))
      .catch((e) =>
        e instanceof TeamPortError && e.code === 'not-eligible'
          ? setError(tm.jtNotEligible)
          : e instanceof TeamPortError && e.code === 'closed'
            ? setPhase({ k: 'closed' })
            : setPhase({ k: 'offline' }),
      )
      .finally(() => setBusy(false));
  };

  const done = { label: tm.jtOk, onClick: onExit };
  const custom = (() => {
    switch (phase.k) {
      case 'loading':
        return { by: '', title: tm.jtLoading, body: '', busy: true };
      case 'offline':
        return {
          by: '',
          title: tm.jtOfflineTitle,
          body: tm.jtOfflineBody,
          primary: {
            label: tm.jtRetry,
            onClick: () => {
              setPhase({ k: 'loading' });
              load();
            },
          },
        };
      case 'closed':
        return { by: '', title: tm.jtClosedTitle, body: tm.jtClosedBody, primary: done };
      case 'joined':
        return { by: '', title: tm.jtJoinedTitle, body: tm.jtJoinedBody, primary: done };
      case 'declined':
        return { by: '', title: tm.jtDeclinedTitle, body: tm.jtDeclinedBody, primary: done };
      case 'landing': {
        const { inv } = phase;
        const manager = inv.role === 'manager';
        const first = firstName(inv.inviterName);
        return {
          by: tm.jtInviter(inv.ownerName),
          title: tm.jtTitle(first),
          body: manager ? tm.jtBodyManager(first) : tm.jtBodyTrainer(first),
          note: tm.jtUntil(fmtDayMonth(inv.expiresAt, locale)),
          error,
          busy,
          primary: {
            label: manager ? tm.jtJoinManager : tm.jtJoinTrainer,
            onClick: () => act(() => p.acceptInvite(token), { k: 'joined' }),
          },
          secondary: {
            label: tm.jtDecline,
            onClick: () => act(() => p.declineInvite(token), { k: 'declined' }),
          },
        };
      }
    }
  })();

  return (
    <LandingView
      onLoggedIn={() => undefined}
      invite={{ inviter: null, expiresAt: 0, onStart: () => undefined, custom }}
    />
  );
}
