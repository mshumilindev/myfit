/**
 * What the person sees when Coach cannot serve a screen from the real backend (`data/backend.ts`). There is no sample data
 * anywhere in the app: a failure is one of these kit states, never a stand-in world.
 *   <NotConfigured />       `VITE_COACH_BACKEND=off`: a kit FailedState, no client data is rendered at all
 *   <CoachProblemState />   offline / not deployed / denied / timeout / unknown, with Retry
 * Both read the dictionary `coachSafe`; no layout of their own beyond a gap (kit elements only).
 */
import { Button } from '../components/ui/Button';
import { FailedState } from '../components/ui/FailedState';
import { useSafeT, type SafeStrings } from '../i18n/coachSafe';
import type { CoachProblem } from './data/problem';
import './BackendNotice.css';

/** `VITE_COACH_BACKEND=off`: say so calmly and offer the way back. */
export function NotConfigured({ onBack }: { onBack?: () => void }) {
  const { sf } = useSafeT();
  return (
    <div className="co-notcfg" data-testid="coach-not-configured">
      <FailedState icon="plugs" title={sf.offTitle} body={sf.offBody} />
      {onBack && (
        <Button variant="secondary" onClick={onBack}>
          {sf.offBack}
        </Button>
      )}
    </div>
  );
}

/** [title, body, icon] of one problem, in the person's language. */
export function problemWords(sf: SafeStrings, problem: CoachProblem): [string, string, string] {
  switch (problem) {
    case 'offline':
      return [sf.pbOfflineTitle, sf.pbOfflineBody, 'cloud-slash'];
    case 'not-deployed':
      return [sf.pbNotDeployedTitle, sf.pbNotDeployedBody, 'plugs'];
    case 'denied':
      return [sf.pbDeniedTitle, sf.pbDeniedBody, 'lock'];
    case 'timeout':
      return [sf.pbTimeoutTitle, sf.pbTimeoutBody, 'hourglass'];
    default:
      return [sf.pbUnknownTitle, sf.pbUnknownBody, 'warning-circle'];
  }
}

/**
 * The real backend could not serve this screen: what is wrong in plain words (offline / not deployed / denied / timeout /
 * unknown), a Retry, and in `npm run dev` one extra hint line. Kit FailedState only.
 * `title`/`body` override the words when a screen has its own (e.g. "Couldn't load your trainer").
 */
export function CoachProblemState({
  problem,
  onRetry,
  onBack,
  inline,
}: {
  problem: CoachProblem;
  onRetry: () => void;
  onBack?: () => void;
  /** inside a page that has its own width (no centring wrapper) */
  inline?: boolean;
}) {
  const { sf } = useSafeT();
  const [title, body, icon] = problemWords(sf, problem);
  const hint = !!import.meta.env?.DEV && problem !== 'offline';
  return (
    <div
      className={inline ? 'co-pb' : 'co-notcfg'}
      data-testid="coach-backend-failed"
      data-problem={problem}
    >
      <FailedState
        icon={icon}
        title={title}
        body={
          <>
            {body}
            {hint && (
              <span className="co-pb-hint" data-testid="coach-dev-hint">
                {sf.pbDevHint}
              </span>
            )}
          </>
        }
        retryLabel={sf.retry}
        onRetry={onRetry}
      />
      {onBack && (
        <div className="co-pb-actions">
          <Button variant="secondary" onClick={onBack}>
            {sf.offBack}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The real backend could not be started (module or key setup failed, or it did not finish in time). */
export function CoachBackendFailed({
  onRetry,
  onBack,
  problem = 'unknown',
}: {
  onRetry: () => void;
  onBack?: () => void;
  problem?: CoachProblem;
}) {
  return <CoachProblemState problem={problem} onRetry={onRetry} onBack={onBack} />;
}
