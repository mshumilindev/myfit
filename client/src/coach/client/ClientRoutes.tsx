import { useEffect } from 'react';
import { getRole } from '../../api';
import { coachIsUnconfigured } from '../data/backend';
import { NotConfigured } from '../BackendNotice';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useClientT } from '../../i18n/coachClient';
import { PushedPage } from './screens/PushedPage';
import { useClientCoachBackend } from './gate';
import { AccessLogPage } from './screens/AccessLogPage';
import { ClientChat } from './screens/ClientChat';
import { InvitePages } from './screens/InvitePages';
import { TrainerUnavailable } from './screens/TrainerUnavailable';
import { MyTrainerPage } from './screens/MyTrainerPage';
import { NoTrainerPage } from './screens/NoTrainerPage';
import type { ClientCoachPort } from './data/port';
import { useClientCoach } from './data/useClientCoach';
import { parseClientRoute } from './routes';
import { navigateHash } from '../../navigateHash';
import './ClientCoach.css';

const go = (hash: string) => {
  navigateHash(hash);
};

/**
 * The overlay behind `#/invite/..` and `#/trainer/..`. Default export so the real app can `lazy()` it: nothing of the
 * client trainer features is in the Gym bundle until one of these routes (or the flag-gated bridge) is opened.
 */
export default function ClientRoutes(p: { route: string; onClose: () => void }) {
  // the Gym shell's stage is the <main> landmark; this wrapper takes no box (see ClientCoach.css)
  return (
    <div className="cc-main">
      <Routes {...p} />
    </div>
  );
}

function Routes({ route, onClose }: { route: string; onClose: () => void }) {
  const { on: enabled, status, retry, problem } = useClientCoachBackend();
  const on = enabled && status === 'ready';
  const { cc } = useClientT();
  const r = parseClientRoute(route);
  // (a trainer's own account, or a link that is not ours: behave like an unknown route)
  const unconfigured = getRole() !== 'trainer' && coachIsUnconfigured() && !!r;
  // the real backend could not be installed: say so with Retry, never the sample trainer
  const failed = enabled && status === 'failed' && !!r;
  // loading is NOT blocked: the real adapters install in milliseconds, the page waits instead of bouncing to Today
  const blocked = !unconfigured && !failed && (!enabled || !r);
  useEffect(() => {
    if (blocked) onClose();
  }, [blocked, onClose]);
  // This production build has no Coach backend: explain instead of bouncing to Today.
  if (unconfigured)
    return (
      <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={onClose}>
        <NotConfigured />
      </PushedPage>
    );
  if (failed)
    return (
      <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={onClose}>
        <TrainerUnavailable
          problem={problem ?? 'unknown'}
          onRetry={retry}
          onSharing={() => go('#/health/privacy')}
        />
      </PushedPage>
    );
  if (enabled && status === 'loading' && r)
    return (
      <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={onClose}>
        <SkeletonRows rows={4} label={cc.ccLoading} />
      </PushedPage>
    );
  if (!on || !r) return null;
  if (r.page === 'invite')
    return (
      <InvitePages
        token={r.token}
        onExit={(to) =>
          go(to === 'chat' ? '#/trainer/chat' : to === 'sharing' ? '#/health/privacy' : '#/today')
        }
      />
    );
  if (r.page === 'chat') return <ChatGate onClose={onClose} />;
  if (r.page === 'log') return <AccessLogPage onBack={onClose} />;
  return (
    <MyTrainerPage
      onBack={onClose}
      onChat={() => go('#/trainer/chat')}
      onSharing={() => go('#/health/privacy')}
      onProgram={() => go('#/programs')}
      onLeft={() => go('#/today')}
    />
  );
}

/** `#/trainer/chat` without a trainer link is the "No trainer yet" page, not a thread skeleton that never ends. */
export function ChatGate({ onClose, port }: { onClose: () => void; port?: ClientCoachPort }) {
  const { snapshot } = useClientCoach(port);
  const link = snapshot?.link;
  if (snapshot && (!link || link.state === 'none' || !link.trainer))
    return <NoTrainerPage onBack={onClose} />;
  return (
    <ClientChat
      port={port}
      onBack={onClose}
      onOpenSharing={() => go('#/health/privacy')}
      onOpenTrainer={() => go('#/trainer')}
      onOpenProgram={() => go('#/programs')}
    />
  );
}
