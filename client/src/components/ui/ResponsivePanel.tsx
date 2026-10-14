import type { ReactNode, RefObject } from 'react';
import { COACH_BREAKPOINT, useMinWidth } from './breakpoints';
import { Sheet } from './Overlays';
import { Popover } from './Popover';
import './ResponsivePanel.css';

export interface ResponsivePanelProps {
  open: boolean;
  onClose: () => void;
  /** The button the desktop popover points at (focus returns to it). */
  anchorRef: RefObject<HTMLElement | null>;
  /** Accessible name of the panel. */
  label: string;
  /** Visible heading inside the panel. */
  title?: string;
  /** Popover width on desktop, px. */
  width?: number;
  /** Sticky action row (Cancel / primary) under the body. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * One panel, two presentations: an anchored glass `Popover` from the Coach breakpoint up, a bottom `Sheet` on a
 * phone (the kit rule: callers pick by width). Used by the export menu and the Decisions filters.
 */
export function ResponsivePanel({
  open,
  onClose,
  anchorRef,
  label,
  title,
  width = 360,
  footer,
  children,
}: ResponsivePanelProps) {
  const desktop = useMinWidth(COACH_BREAKPOINT);
  if (!open) return null;
  const body = (
    <div className="rpanel">
      {title && <h2 className="rpanel-t">{title}</h2>}
      <div className="rpanel-b">{children}</div>
      {footer && <div className="rpanel-f">{footer}</div>}
    </div>
  );
  if (!desktop) {
    return (
      <Sheet onClose={onClose} padded label={label} returnFocusRef={anchorRef}>
        {body}
      </Sheet>
    );
  }
  return (
    <Popover
      open
      onClose={onClose}
      anchorRef={anchorRef}
      side="bottom"
      align="end"
      width={width}
      arrow
      scrim
      label={label}
    >
      {body}
    </Popover>
  );
}
