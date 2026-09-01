/**
 * Switcher — a segmented control with a sliding pill thumb (not tabs). The
 * highlight animates between N equal slots; each option is an icon over a label.
 * Generic over the option value; used for the activity Effort control.
 */
import type { CSSProperties } from 'react';
import { Icon } from '../ui';

export type SwitcherOption<T extends string> = {
  value: T;
  label: string;
  icon: string;
};

export function Switcher<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SwitcherOption<T>[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const style = { '--sw-n': options.length, '--sw-i': idx } as CSSProperties;
  return (
    <div className="switcher" role="radiogroup" aria-label={ariaLabel} style={style}>
      <span className="switcher-thumb" aria-hidden />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`switcher-opt${value === o.value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          <Icon name={o.icon} weight={value === o.value ? 'fill' : undefined} />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
