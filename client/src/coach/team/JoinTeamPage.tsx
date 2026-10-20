import { useCallback, useEffect, useState } from 'react';
import { SpotterMark } from '../../brand/SpotterMark';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { fmtDayMonth } from '../../i18n';
import { useTeamT } from '../../i18n/coachTeam';
import { Icon } from '../../ui';
import { ClientAvatar } from '../ClientAvatar';
import { firstName } from '../screens/format';
import '../client/ClientCoach.css';
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
 * "Join the team" (`#/team-invite/<token>`, board D16): who invited you, what the role can see, Join / Decline.
 * Nothing is written before the person taps Join or Decline. A closed link (used, withdrawn, expired) is a plain
 * page, never a spinner; offline is a page with Try again. Board copy is made gender-neutral (the inviter's name).
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

  if (phase.k === 'loading')
    return (
      <div className="onb-shell center">
        <div className="onb-card cc-skel" role="status" aria-label={tm.jtLoading}>
          <Skeleton className="cc-skel-mark" />
          <Skeleton className="cc-skel-line" />
          <Skeleton className="cc-skel-line" />
          <Skeleton className="cc-skel-btn" />
        </div>
      </div>
    );

  if (phase.k === 'offline')
    return (
      <div className="onb-shell center">
        <div className="onb-card">
          <Icon name="cloud-slash" className="onb-dead-icon" />
          <h2>{tm.jtOfflineTitle}</h2>
          <p className="lead">{tm.jtOfflineBody}</p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setPhase({ k: 'loading' });
              load();
            }}
          >
            {tm.jtRetry}
          </Button>
        </div>
      </div>
    );

  if (phase.k !== 'landing') {
    const [icon, title, body] =
      phase.k === 'closed'
        ? (['warning-circle', tm.jtClosedTitle, tm.jtClosedBody] as const)
        : phase.k === 'joined'
          ? (['check-circle', tm.jtJoinedTitle, tm.jtJoinedBody] as const)
          : (['prohibit', tm.jtDeclinedTitle, tm.jtDeclinedBody] as const);
    return (
      <div className="onb-shell center">
        <div className="onb-card" role={phase.k === 'closed' ? 'alert' : undefined}>
          <Icon name={icon} className="onb-dead-icon" />
          <h2>{title}</h2>
          <p className="lead">{body}</p>
          <Button variant="primary" size="lg" onClick={onExit}>
            {tm.jtOk}
          </Button>
        </div>
      </div>
    );
  }

  const { inv } = phase;
  const first = firstName(inv.inviterName);
  const manager = inv.role === 'manager';
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

  return (
    <div className="onb-shell center">
      <div className="onb-card landing">
        <SpotterMark size={48} variant="tight" className="onb-wordmark" />
        <h1 className="display">{tm.jtTitle(first)}</h1>
        <p className="lead">{manager ? tm.jtBodyManager(first) : tm.jtBodyTrainer(first)}</p>
        <div className="onb-inviter">
          <ClientAvatar id={undefined} name={inv.ownerName} size={40} hasPhoto={false} />
          <span>{tm.jtInviter(inv.ownerName)}</span>
        </div>
        {error && (
          <p className="cc-err" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          loading={busy}
          onClick={() => act(() => p.acceptInvite(token), { k: 'joined' })}
        >
          {manager ? tm.jtJoinManager : tm.jtJoinTrainer} <Icon name="arrow-right" />
        </Button>
        <Button
          variant="link"
          disabled={busy}
          onClick={() => act(() => p.declineInvite(token), { k: 'declined' })}
        >
          {tm.jtDecline}
        </Button>
        <div className="footnote center">{tm.jtUntil(fmtDayMonth(inv.expiresAt, locale))}</div>
      </div>
    </div>
  );
}
