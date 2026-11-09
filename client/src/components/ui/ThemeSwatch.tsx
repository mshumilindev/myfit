import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../../ui';
import './ThemeSwatch.css';

export interface ThemeSwatchProps {
  /** Colour name, shown as-is (not translated by the kit). */
  name: string;
  /** The accent in light and dark mode: the card splits diagonally between the two. */
  light: string;
  dark: string;
  /** Short labels in front of the two codes (e.g. "L" / "D", "Д" / "Н"). */
  lightLabel: string;
  darkLabel: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}

/** A colour swatch card: diagonal light/dark split, name and both codes; selected = ring + check.
 *  One radio of a `ThemeSwatchGrid`. */
export function ThemeSwatch({
  name,
  light,
  dark,
  lightLabel,
  darkLabel,
  selected,
  onSelect,
  className,
}: ThemeSwatchProps) {
  const style = { '--sw-light': light, '--sw-dark': dark } as CSSProperties;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={['uithsw', selected ? 'is-selected' : '', className].filter(Boolean).join(' ')}
      style={style}
      onClick={onSelect}
    >
      <span className="uithsw-chip" aria-hidden="true">
        {selected && (
          <span className="uithsw-check">
            <Icon name="check" weight="bold" />
          </span>
        )}
      </span>
      <span className="uithsw-body">
        <span className="uithsw-name">{name}</span>
        <span className="uithsw-code">
          <i>{lightLabel}</i>
          {light.toUpperCase()}
        </span>
        <span className="uithsw-code">
          <i>{darkLabel}</i>
          {dark.toUpperCase()}
        </span>
      </span>
    </button>
  );
}

/** The radiogroup around the cards: 3 columns on a phone, 4 from 720px. */
export function ThemeSwatchGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="uithsw-grid" role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}
