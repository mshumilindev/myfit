import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';

/** The end-state strip under a decision (recorded, waiting, dismissed): a kit Notice with its action. */
export function OutcomeNote({
  tone = 'neutral',
  icon,
  head,
  sub,
  action,
  onAction,
  ariaLabel,
}: {
  tone?: 'ok' | 'neutral';
  icon: string;
  head: string;
  sub: string;
  action: string;
  onAction: () => void;
  ariaLabel?: string;
}) {
  return (
    <Notice
      tone={tone}
      icon={icon}
      aria-label={ariaLabel}
      trail={
        <Button variant="fill" iconTrailing="arrow-right" onClick={onAction}>
          {action}
        </Button>
      }
    >
      <strong className="td-note-h">{head}</strong>
      <span className="td-note-s">{sub}</span>
    </Notice>
  );
}
