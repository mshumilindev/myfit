import { Icon } from '../../ui';
import { ListRow } from './GroupedList';

export interface SuiteLauncherRowProps {
  /** "Apps" (translated by the caller). */
  label: string;
  /** Opens the suite launcher (the Shell sheet that switches Gym / Apex / People / …). */
  onOpen: () => void;
  /** Icon name from the app registry. */
  icon?: string;
}

/**
 * The "Apps" row: one entry that opens the suite launcher from a menu (kit, app-agnostic).
 * A `ListRow`, so it sits in the same `GroupedList` as the app's own More destinations.
 */
export function SuiteLauncherRow({ label, onOpen, icon = 'squares-four' }: SuiteLauncherRowProps) {
  return <ListRow icon={<Icon name={icon} />} label={label} chevron onClick={onOpen} />;
}
