import { Chip } from './Chip';
import './FilterGroup.css';

export interface FilterOption {
  id: string;
  label: string;
  /** How many items match this option. 0 dims and disables it (unless it is on, so it can be turned off). */
  count?: number;
}

export interface FilterGroupProps {
  label: string;
  options: FilterOption[];
  /** Ids of the options that are on. */
  active: string[];
  onToggle?: (id: string) => void;
  className?: string;
}

/**
 * A labelled multi-select group of filter chips (kit `filter-group`): a `fieldset` whose legend is the
 * group name. Options that match nothing are disabled so a filter set can never lead to an empty list
 * by surprise; an option that is on stays enabled.
 */
export function FilterGroup({ label, options, active, onToggle, className }: FilterGroupProps) {
  return (
    <fieldset className={['uifg', className].filter(Boolean).join(' ')}>
      <legend className="uifg-l">{label}</legend>
      <div className="uifg-c">
        {options.map((o) => {
          const on = active.includes(o.id);
          return (
            <Chip
              key={o.id}
              selected={on}
              disabled={!on && o.count === 0}
              onClick={() => onToggle?.(o.id)}
            >
              {o.label}
            </Chip>
          );
        })}
      </div>
    </fieldset>
  );
}
