/**
 * Shell chrome slots of the Coach Header (polish F3).
 *
 * The shell (CoachApp) owns what sits at the right edge of every page header and provides it through
 * this context; `Header` renders it. Without a provider (stories, unit tests, the Header on its own)
 * there are no slots, so Header stays backward compatible.
 *
 *   >= 768   "N live" pill (the search icon is PARKED: iter20, see docs/COACH-STATUS.md)
 *   <  768   "N live" pill, bell with unread badge, avatar (opens the account sheet)
 *
 * The bell count goes through the kit Badge (R-FE-010), the live pill through the kit LiveWidget. (`BellButton` is
 * only styled inside a BrandBar, so the header composes IconButton + Badge, the same pair the rail uses.)
 */
import { createContext, useContext, type ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button, IconButton } from '../../components/ui/Button';
import { LiveWidget, type LiveWidgetProps } from '../../components/ui/LiveWidget';
import './chrome.css';

export interface CoachChrome {
  /** Wide layout (rail): live pill + search icon. Narrow: live pill + bell + avatar. */
  desktop: boolean;
  /** Parked (iter20): the header search has no UI right now; the fields stay so it can come back. */
  searchLabel: string;
  onSearch: () => void;
  bellLabel: string;
  bellCount: number;
  onBell: () => void;
  /** The "N live" widget; null hides it (nobody is training). */
  live: LiveWidgetProps | null;
  /** Phone avatar button (already a button). */
  avatar?: ReactNode;
}

const ChromeContext = createContext<CoachChrome | null>(null);

export const CoachChromeProvider = ChromeContext.Provider;

export function useCoachChrome(): CoachChrome | null {
  return useContext(ChromeContext);
}

/** The right-hand slots of a page header. Renders nothing outside the shell. */
export function HeaderSlots() {
  const chrome = useCoachChrome();
  if (!chrome) return null;
  const { desktop, live } = chrome;
  return (
    <div className="co-slots">
      {live && <LiveWidget {...live} className="co-live" />}
      {!desktop && (
        <>
          <span className="co-bell">
            <IconButton
              icon="bell"
              label={
                chrome.bellCount > 0
                  ? `${chrome.bellLabel} (${chrome.bellCount})`
                  : chrome.bellLabel
              }
              shape="round"
              onClick={chrome.onBell}
            />
            <Badge n={chrome.bellCount} anchor="corner" />
          </span>
          {chrome.avatar}
        </>
      )}
    </div>
  );
}

/** Phone: the avatar button that opens the account sheet (same `account-chip` look as the rail foot). */
export function AccountButton({
  label,
  onOpen,
  children,
}: {
  label: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      className="account-chip"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <span className="account-avatar">{children}</span>
    </Button>
  );
}
