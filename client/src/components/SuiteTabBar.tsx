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

/** Buttons a phone tab bar holds, More included. */
const MAX_TABS = 5;

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
  // A bar with fewer than 5 buttons (More included) pulls destinations out of More and shows them as tabs, so the bar is
  // not half empty (owner 07.11). Rows that open a submenu (Language) stay in More. Bars with the Start "+" keep their shape.
  const room = noMore || bar.fab ? 0 : Math.max(0, MAX_TABS - (bar.items.length + 1));
  const promoted = moreItems.filter((i) => !i.submenu).slice(0, room);
  const rest = moreItems.filter((i) => !promoted.includes(i));
  const items = [
    ...bar.items,
    ...promoted.map((i) => ({
      id: i.id as Id,
      label: i.label,
      icon: i.icon,
      active: i.active,
      badge: i.count,
    })),
  ];
  const onSelect = (id: Id) => {
    const hit = promoted.find((i) => i.id === id);
    if (hit) hit.onSelect();
    else bar.onSelect(id);
  };
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
        items={items}
        onSelect={onSelect}
        more={
          noMore
            ? undefined
            : {
                label: c.navMore,
                open,
                active: open || rest.some((i) => i.active),
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
          items={rest}
          account={noAccount ? undefined : account}
        />
      )}
      {!noMore && !noAccount && dialog}
    </>
  );
}
