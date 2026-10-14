/**
 * The sticky footer of a coach panel (drawer on a wide screen, sheet on a phone). The panel owns a footer host that sits
 * OUTSIDE the scrolling body; any content inside the panel renders its action buttons there with `<PanelFooter>`, so
 * "Save / Cancel" and "Move / Cancel session" are always in view, on the same plate as the panel, never a box of their
 * own. Outside a panel (a story, a test) `<PanelFooter>` renders inline, so a form still works on its own.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FooterHost = createContext<HTMLElement | null>(null);

/** For a panel: `host` is the footer element once mounted; wrap the body in `<FooterHostProvider host>`. */
export function usePanelFooterHost(): {
  host: HTMLElement | null;
  setHost: (el: HTMLElement | null) => void;
} {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return { host, setHost };
}

export const FooterHostProvider = FooterHost.Provider;

export function PanelFooter({ children }: { children: ReactNode }) {
  const host = useContext(FooterHost);
  const bar = <div className="co-foot-actions">{children}</div>;
  return host ? createPortal(bar, host) : <div className="co-foot-inline">{bar}</div>;
}
