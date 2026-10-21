/**
 * The pinned bottom of every rail in the suite, Coach included: Apps (opens the launcher), then
 * the account trigger (real 34px avatar, optional warning dot) with its `AccountPopover`. ONE
 * component, so the avatar and Apps sit at the same offset from the bottom in all six apps.
 * `appsUnread` puts the shared feed's unread count on Apps for apps without a bell. Sizes come from Rail.css (`.rail-foot` items and `.account-chip` are fixed 44px slots); the rail
 * frame (padding, gap) is the shared one from styles.css. Nothing here is app specific.
 */
import { useRef, useState } from 'react';
import { useCoachT } from '../../i18n/coach';
import { Button } from '../ui/Button';
import { AccountPopover } from '../ui/AccountPopover';
import { RailItem } from '../ui/Rail';
import {
  useSuiteAccount,
  type SuiteApp,
  type SuiteIdentity,
  type SuiteMode,
} from './useSuiteAccount';

export function SuiteRailFoot({
  app,
  onOpenShell,
  onOpenProfile,
  onOpenGym,
  identity,
  warnColor,
  appsUnread = 0,
}: {
  app: SuiteApp;
  onOpenShell: () => void;
  onOpenProfile?: () => void;
  onOpenGym?: () => void;
  identity?: SuiteIdentity;
  /** Warning dot on the avatar (Gym: offline / sync failed). No dot while all is well. */
  warnColor?: string;
  /** Unread of the shared feed, shown on Apps in apps that have no bell (People, Coach). */
  appsUnread?: number;
}) {
  const { c } = useCoachT();
  const { account, title, avatar, dialog } = useSuiteAccount({
    app,
    onOpenProfile,
    onOpenGym,
    identity,
  });
  const accountRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Apps: pinned directly above the avatar, never part of the overflow. */}
      <RailItem
        icon="squares-four"
        className="rail-switch"
        label={c.navApps}
        tooltip={c.navApps}
        aria-haspopup="dialog"
        count={appsUnread}
        countLabel={c.unread(appsUnread)}
        onClick={onOpenShell}
      />
      <div ref={accountRef} className="rail-account">
        <Button
          variant="ghost"
          className="account-chip"
          aria-label={title}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="account-avatar">
            {avatar(34)}
            {warnColor && <span className="dot" style={{ background: warnColor }} />}
          </span>
        </Button>
      </div>
      <AccountPopover<SuiteMode>
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={accountRef}
        title={title}
        account={account}
      />
      {dialog}
    </>
  );
}
