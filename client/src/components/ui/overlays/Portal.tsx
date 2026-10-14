import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/** Renders overlays into document.body, clicks stopped at the boundary. */
export function Portal(props: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{props.children}</>;
  // React bubbles portal events through the COMPONENT tree, not the DOM: a tap
  // on a sheet's scrim (or anything inside it) would otherwise reach whatever
  // row/button rendered the sheet and trigger it "under" the drawer. The
  // wrapper is layout-neutral and stops clicks at the portal boundary.
  return createPortal(
    <div className="portal-layer" onClick={(e) => e.stopPropagation()}>
      {props.children}
    </div>,
    document.body,
  );
}
