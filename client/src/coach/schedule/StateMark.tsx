import { Icon } from '../../ui';
import { MARK_ICON, type MarkKey } from './status';

/** Class that gives an element the colour of a state (`--sc-state`); cards and legend chips both wear it. */
export const stateClass = (k: MarkKey): string => `sc-st sc-st--${k}`;

/**
 * The swatch of a state: the same dot + glyph on a calendar card and in its legend chip. Colour comes from the shared
 * `.sc-st--*` classes (Schedule.css), so a state has ONE look everywhere.
 */
export function StateMark({ state, className }: { state: MarkKey; className?: string }) {
  const icon = MARK_ICON[state];
  return (
    <span
      className={[stateClass(state), 'sc-mark', icon ? '' : 'sc-mark--dot', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {icon && <Icon name={icon} />}
    </span>
  );
}
