import { Button } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Notice';
import { useSafeT } from '../../i18n/coachSafe';

/**
 * "Iryna's security code changed" (plan Part C.2 no. 5): a visible strip in the chat until the person has looked at the
 * new code. It says what happened (this device re-wrapped the chat key for the new key) and offers Review.
 */
export function KeyChangeBanner({
  name,
  onReview,
  className,
}: {
  name: string;
  onReview: () => void;
  className?: string;
}) {
  const { sf } = useSafeT();
  return (
    <Notice
      tone="injury"
      icon="shield-warning"
      className={className}
      data-testid="key-change-banner"
      below={sf.scChangedBody(name)}
      trail={
        <Button variant="secondary" size="sm" onClick={onReview}>
          {sf.scChangedReview}
        </Button>
      }
    >
      <strong>{sf.scChangedTitle(name)}</strong>
    </Notice>
  );
}
