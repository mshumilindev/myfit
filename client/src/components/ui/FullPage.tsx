import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBlockingSheetTrap } from './overlays/sheetTrap';
import './FullPage.css';

export interface FullPageProps {
  /** Accessible name of the page. */
  label: string;
  /** Above the content (a Stepper). */
  top?: ReactNode;
  children: ReactNode;
  /** Pinned to the bottom edge (buttons). */
  actions?: ReactNode;
  /** Beside the page, not in it (confirm dialogs). */
  aside?: ReactNode;
}

/**
 * A blocking, opaque full-screen page for what must be finished before the app is used (legal gate, steps): one column
 * on a phone and on a desktop, the app behind it inert (keyboard and screen readers), actions pinned at the bottom.
 * Story `Kit/FullPage`.
 */
export function FullPage({ label, top, children, actions, aside }: FullPageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useBlockingSheetTrap(ref, true);
  return createPortal(
    <div className="portal-layer uifp-layer">
      <div
        className="uifp"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="uifp-in">
          {top}
          {children}
        </div>
        {actions && (
          <div className="uifp-bar">
            <div className="uifp-bar-in">{actions}</div>
          </div>
        )}
      </div>
      {aside}
    </div>,
    document.body,
  );
}
