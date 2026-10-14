import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Notice } from '../../../components/ui/Notice';
import { useMyTrainer } from '../../../today/myTrainer';
import { useClientT } from '../../../i18n/coachClient';
import { useSafeT } from '../../../i18n/coachSafe';
import { ClientAvatar } from '../../ClientAvatar';
import { CoachProblemState, problemWords } from '../../BackendNotice';
import type { CoachProblem } from '../../data/problem';

/**
 * "My trainer" when the Coach backend cannot be reached (offline, not deployed, denied, too slow). If the member has the
 * LEGACY trainer card (the `profileMe` trainer the Today tile shows) the identity stays on screen with a calm note and the
 * actions that still work without Coach (the privacy page, Retry); only a member with no such card sees the plain error.
 * Never an empty skeleton.
 */
export function TrainerUnavailable({
  problem,
  onRetry,
  onSharing,
}: {
  problem: CoachProblem;
  onRetry: () => void;
  onSharing: () => void;
}) {
  const legacy = useMyTrainer(true);
  const { cc } = useClientT();
  const { sf } = useSafeT();
  if (!legacy) return <CoachProblemState inline problem={problem} onRetry={onRetry} />;
  const [title, body, icon] = problemWords(sf, problem);
  return (
    <>
      <Card emphasis="hero" pad="lg" className="cc-hero" data-testid="legacy-trainer-card">
        <ClientAvatar id={legacy.id} name={legacy.name} size={56} hasPhoto={legacy.avatar} />
        <div className="cc-hero-t">
          <h2 className="cc-h2">{legacy.name}</h2>
          <span>{cc.mtLegacyRole}</span>
        </div>
        <div className="cc-hero-b">
          <Button variant="secondary" size="md" icon="eye" onClick={onSharing}>
            {cc.mtSharing}
          </Button>
        </div>
      </Card>
      <Notice
        tone="note"
        icon={icon}
        role="status"
        trail={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {sf.retry}
          </Button>
        }
      >
        <strong>{title}</strong> {body} {cc.mtLegacyNote}
      </Notice>
    </>
  );
}
