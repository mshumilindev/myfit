import type { MouseEvent, ReactNode } from 'react';
import { Sheet } from '../../components/ui/Overlays';
import { useCoachOverlayTheme } from './coachTheme';
import { FooterHostProvider, usePanelFooterHost } from './footerSlot';
import './SidePanel.css';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Spoken and visible title. */
  title: string;
  closeLabel: string;
  children: ReactNode;
  /** A faint scrim, for a panel over content that stays readable (the calendar behind the session panel). */
  scrim?: 'default' | 'light';
  /** A click on the scrim (default: close). The schedule uses it to pass the click on to the session under it. */
  onScrimClick?: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * The detail panels of Coach (session, forms, library peek, notes) are the app's own kit `Sheet`: the same drawer the
 * other apps use (right panel on a wide screen, bottom sheet on a phone, grabber, swipe, Esc, scrim, focus return).
 * Coach differs only by colour, which comes from the theme tokens (`html.theme-coach`). This wrapper adds the two
 * things a Coach form needs on top: a title line like the other sheets', and a pinned footer for `<PanelFooter>`.
 */
export function SidePanel({
  open,
  onClose,
  title,
  closeLabel,
  children,
  scrim,
  onScrimClick,
}: SidePanelProps) {
  const { host, setHost } = usePanelFooterHost();
  useCoachOverlayTheme(open);
  if (!open) return null;
  return (
    <Sheet
      onClose={onClose}
      padded
      label={title}
      closeLabel={closeLabel}
      scrim={scrim}
      onScrimClick={onScrimClick}
    >
      <div className="sdp-sheet">
        <div className="sheet-head">
          <span className="t" role="heading" aria-level={2}>
            {title}
          </span>
        </div>
        <FooterHostProvider value={host}>{children}</FooterHostProvider>
        <div className="sdp-foot" ref={setHost} />
      </div>
    </Sheet>
  );
}
