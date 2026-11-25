import { Button } from './Button';
import { Chip } from './Chip';
import './ActiveFilters.css';

export interface ActiveFilterItem {
  id: string;
  label: string;
}

export interface ActiveFiltersProps {
  items: ActiveFilterItem[];
  onRemove?: (id: string) => void;
  /** Omit to hide "Clear all" (e.g. when one filter is on and removing it already clears everything). */
  onClear?: () => void;
  /** Accessible name of the group ("Active filters"). */
  groupLabel: string;
  /** Visible text of the clear button ("Clear all"). */
  clearLabel: string;
  /** Accessible name of each chip's remove action ("Remove Beginner"). */
  removeLabel: (label: string) => string;
  className?: string;
}

/**
 * The filters that are on, as removable chips in one scrolling row, with an optional "Clear all"
 * (kit `active-filters`). Renders nothing when no filter is on. All strings come from the caller (i18n).
 */
export function ActiveFilters({
  items,
  onRemove,
  onClear,
  groupLabel,
  clearLabel,
  removeLabel,
  className,
}: ActiveFiltersProps) {
  if (!items.length) return null;
  return (
    <div
      className={['uiaf', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={groupLabel}
    >
      <div className="uiaf-c">
        {items.map((i) => (
          <Chip
            key={i.id}
            selected
            icon="x"
            onClick={() => onRemove?.(i.id)}
            aria-label={removeLabel(i.label)}
          >
            {i.label}
          </Chip>
        ))}
      </div>
      {onClear && (
        <Button variant="link" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      )}
    </div>
  );
}
