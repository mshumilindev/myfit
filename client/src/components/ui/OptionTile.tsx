import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface OptionTileProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'role' | 'type'
> {
  /** The chosen tile of its group (`aria-checked`, and the `is-on` class the caller styles). */
  selected: boolean;
  children?: ReactNode;
}

/**
 * One tile of a radio picker (an icon grid, a colour row): a pressable `role="radio"` button that only carries the
 * state and the semantics. The look (size, ring, fill) comes from the caller's class, so the same piece serves every
 * picker. Put the tiles in a `role="radiogroup"` with a label. Not for a single on/off (use `Switch`) or a row of
 * options that all show text (use `Segmented` or `Chip`).
 */
export function OptionTile({ selected, className, children, ...rest }: OptionTileProps) {
  const cls = ['ui-opt', className, selected ? 'is-on' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" role="radio" aria-checked={selected} className={cls} {...rest}>
      {children}
    </button>
  );
}
