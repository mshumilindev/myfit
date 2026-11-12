import { useState } from 'react';
import { usePlannerHost } from '../plannerRt';

/**
 * Planner's entry on Today: a fixed block of the week card (a card of its own when there is no week card), there for as long as the add-on is installed — with plans it shows the next
 * one, without it invites to add one, so Planner is always one tap away. It belongs to the program section, so (like the section
 * itself) it cannot be removed; the words and the card come from the Planner chunk (the core carries none of them).
 */
export function PlannerEntry({
  now,
  size = 'L',
  inline = false,
  onOpen,
}: {
  now?: number;
  size?: 'M' | 'L' | 'XL';
  /** Inside the week card, without a card of its own. */
  inline?: boolean;
  onOpen: () => void;
}) {
  const [mounted] = useState(() => Date.now());
  const Body = usePlannerHost()?.UpNext;
  if (!Body) return null;
  return (
    <div className="td-planner-entry" data-testid="planner-entry">
      <Body size={size} now={now ?? mounted} variant={inline ? 'inline' : 'card'} onOpen={onOpen} />
    </div>
  );
}
