/**
 * The phone tab bar of every app in the suite: the app's own tabs (unchanged) plus the trailing
 * More tab that replaced the old "Apps" button. The app switcher is the BrandBar chip, not a row here. Like Coach, More opens a bottom sheet:
 * the app's secondary destinations (`moreItems`, may be empty), then the account block (real avatar, name, role, mode switch for
 * trainer/admin, privacy note, Profile).
 *
 * No extra tab is added anywhere: More takes the slot Apps had, so every tab bar has the same
 * number of buttons as before.
 */
import { useEffect, useState } from 'react';
import { useCoachT } from '../i18n/coach';
import { MoreMenu, type MoreMenuItem } from './ui/MoreMenu';
import { TabBar, type TabBarProps } from './ui/TabBar';
import { SUITE_TONE } from './suite/suiteTone';
import { OPEN_MORE_EVENT } from './suite/openMore';
import { useSuiteAccount, type SuiteApp, type SuiteMode } from './suite/useSuiteAccount';

export function SuiteTabBar<Id extends string = string>({
  app,
  moreItems = [],
  noMore,
  noAccount,
  onOpenProfile,
  ...bar
}: Omit<TabBarProps<Id>, 'apps' | 'more'> & {
  app: SuiteApp;
  /** Destinations that have no tab (shown first in the sheet). */
  moreItems?: MoreMenuItem[];
  /** No More tab at all: the app has nothing for it, so the slot is the app's own tab. */
  noMore?: boolean;
  /** The account block lives in the avatar's user drawer, so More lists destinations only. */
  noAccount?: boolean;
  onOpenProfile?: () => void;
}) {
  const { c } = useCoachT();
  const { account, dialog } = useSuiteAccount({ app, onOpenProfile });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_MORE_EVENT, on);
    return () => window.removeEventListener(OPEN_MORE_EVENT, on);
  }, []);
  return (
    <>
      <TabBar<Id>
        {...bar}
        more={
          noMore
            ? undefined
            : {
                label: c.navMore,
                open,
                active: open || moreItems.some((i) => i.active),
                onClick: () => setOpen(true),
              }
        }
      />
      {!noMore && (
        <MoreMenu<SuiteMode>
          presentation="sheet"
          tone={SUITE_TONE[app]}
          open={open}
          onClose={() => setOpen(false)}
          title={c.navMore}
          items={moreItems}
          account={noAccount ? undefined : account}
        />
      )}
      {!noMore && !noAccount && dialog}
    </>
  );
}
