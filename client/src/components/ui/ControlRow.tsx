import type { HTMLAttributes, ReactNode } from 'react';

export type ControlRowSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ControlRowProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The ONE step of the control scale (styles.css --ctl-h-*) every control inside takes, whatever size
   * prop it was given: icon buttons, buttons, segmented, selects, search, chips line up by construction.
   */
  size?: ControlRowSize;
  /** Items sit on the row's bottom edge (a Select with a label above it) instead of the centre line. */
  alignEnd?: boolean;
  children?: ReactNode;
}

/**
 * A row of controls with one shared height and gap. Use it for every toolbar, header action group,
 * footer button pair and composer that mixes control types (the coach Toolbar and Header already are one).
 */
export function ControlRow({
  size = 'md',
  alignEnd = false,
  className,
  children,
  ...rest
}: ControlRowProps) {
  const cls = ['ctl-row', `ctl-row--${size}`, alignEnd ? 'ctl-row--end' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
