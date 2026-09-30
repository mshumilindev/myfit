/**
 * Switcher — a segmented control with a sliding pill thumb (not tabs). The
 * highlight animates between N equal slots; each option is an icon over a label.
 * Generic over the option value; used for the activity Effort control.
 */
import { Segmented } from './ui/Segmented';

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
  return (
    <Segmented
      label={ariaLabel}
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label, icon: o.icon }))}
    />
  );
}
