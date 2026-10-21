/**
 * The desktop rail of every app in the suite except Coach's own shell (Gym, Apex, People,
 * Nutrition, Learn): maps the app's nav onto the shared `SuiteRail` (kit `Rail` + the one shared
 * foot, SPO-234/235), exactly like Coach's.
 *
 *  - geometry: 88px labelled rail from 1280px, 60px icon-only rail (tooltips) below it; tiles
 *    have fixed sizes and never squeeze with the window height;
 *  - nav: `nav` entries top to bottom; only when they do not all fit vertically the trailing ones
 *    collapse into a More item, otherwise there is no More;
 *  - foot, top to bottom: `extrasBefore`, the bell (client apps only: `onOpenNotifications`),
 *    `extrasAfter`, language, Apps (pinned), the avatar (pinned). The avatar opens ONLY the
 *    account popover; More holds the overflowed entries, the foot extras collapsing first;
 *  - the app's accent comes from the wrapping `.app-*` theme (accent-ramp), not from here.
 *
 * Shown from 720px up (the real apps' swap width, unchanged); below it the app mounts
 * `SuiteTabBar` instead.
 */
import type { RailEntry, RailFootEntry } from './ui/railOverflow';
import { SuiteRail } from './suite/SuiteRail';
import type { SuiteApp } from './suite/useSuiteAccount';

export type RailNavItem = {
  id: string;
  icon: string;
  label: string;
  /** Live dot on the tile (Gym: Today while a workout is open). */
  live?: boolean;
  liveLabel?: string;
  /** Unread count on the tile (1..9, "9+", 0 hidden) and its spoken form. */
  count?: number;
  countLabel?: string;
};

export function AppRail({
  app,
  nav,
  activeId,
  onNav,
  onOpenShell,
  onOpenNotifications,
  onOpenProfile,
  notifUnread = 0,
  extrasBefore,
  extrasAfter,
  syncColor,
}: {
  app: SuiteApp;
  nav: RailNavItem[];
  activeId: string | null;
  onNav: (id: string) => void;
  onOpenShell: () => void;
  /** The bell; omitted = no bell in the foot (People, Coach). The unread then rides on Apps. */
  onOpenNotifications?: () => void;
  /** Profile row of the account popover. */
  onOpenProfile?: () => void;
  /** Unread of the shared feed: on the bell, or on Apps when there is no bell. */
  notifUnread?: number;
  /** App-specific foot extras above the bell (Gym: conditions shield, mastery). */
  extrasBefore?: RailFootEntry[];
  /** App-specific foot extras between the bell and the language (Gym: admin settings). */
  extrasAfter?: RailFootEntry[];
  /** Warning dot on the avatar (Gym: offline / sync failed). No dot while all is well. */
  syncColor?: string;
}) {
  const entries: RailEntry[] = nav.map((x) => ({
    id: x.id,
    label: x.label,
    icon: x.icon,
    active: activeId === x.id,
    onSelect: () => onNav(x.id),
    ...(x.live ? { live: true, liveLabel: x.liveLabel } : {}),
    ...(x.count ? { count: x.count, countLabel: x.countLabel } : {}),
  }));
  return (
    <SuiteRail
      app={app}
      nav={entries}
      footBefore={extrasBefore}
      footAfter={extrasAfter}
      bell={onOpenNotifications ? { onOpen: onOpenNotifications, unread: notifUnread } : undefined}
      appsUnread={onOpenNotifications ? 0 : notifUnread}
      syncColor={syncColor}
      onOpenShell={onOpenShell}
      onOpenProfile={onOpenProfile}
    />
  );
}
