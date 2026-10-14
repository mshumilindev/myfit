/**
 * The phone tab bar of every app in the suite: the app's own tabs (unchanged) plus the trailing
 * More tab that replaced the old "Apps" button. Like Coach, More opens a bottom sheet:
 * the app's secondary destinations (`moreItems`, may be empty), then Apps (last row, opens the
 * suite launcher), then the account block (real avatar, name, role, mode switch for
 * trainer/admin, privacy note, Profile).
 *
 * No extra tab is added anywhere: More takes the slot Apps had, so every tab bar has the same
 * number of buttons as before.
 */
import { useState } from 'react';
import { useCoachT } from '../i18n/coach';
import { MoreMenu, type MoreMenuItem } from './ui/MoreMenu';
import { TabBar, type TabBarProps } from './ui/TabBar';
import { SUITE_TONE } from './suite/suiteTone';
import { useSuiteAccount, type SuiteApp, type SuiteMode } from './suite/useSuiteAccount';

export function SuiteTabBar<Id extends string = string>({
  app,
  moreItems = [],
  onOpenShell,
  onOpenProfile,
  ...bar
}: Omit<TabBarProps<Id>, 'apps' | 'more'> & {
  app: SuiteApp;
  /** Destinations that have no tab (shown first in the sheet). */
  moreItems?: MoreMenuItem[];
  onOpenShell: () => void;
  onOpenProfile?: () => void;
}) {
  const { c } = useCoachT();
  const { account, dialog } = useSuiteAccount({ app, onOpenProfile });
  const [open, setOpen] = useState(false);
  return (
    <>
      <TabBar<Id>
        {...bar}
        more={{
          label: c.navMore,
          open,
          active: open || moreItems.some((i) => i.active),
          onClick: () => setOpen(true),
        }}
      />
      <MoreMenu<SuiteMode>
        presentation="sheet"
        tone={SUITE_TONE[app]}
        open={open}
        onClose={() => setOpen(false)}
        title={c.navMore}
        items={moreItems}
        apps={{ label: c.navApps, onOpen: onOpenShell }}
        account={account}
      />
      {dialog}
    </>
  );
}
