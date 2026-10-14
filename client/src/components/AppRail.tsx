/**
 * The desktop rail of every app in the suite except Coach's own shell (Gym, Apex, People,
 * Nutrition, Learn): the kit `Rail` configured exactly like Coach's, so the navigation works the
 * same everywhere.
 *
 *  - geometry: 88px labelled rail from 1280px, 60px icon-only rail (tooltips) below it; tiles
 *    have fixed sizes and never squeeze with the window height;
 *  - nav: `nav` entries top to bottom; only when they do not all fit vertically the trailing ones
 *    collapse into a More item (kit `Rail` `overflow`), otherwise there is no More;
 *  - the More item (only when needed) sits in the nav column right below the last visible entry;
 *  - foot, top to bottom: extras (`extrasBefore`, the notifications bell,
 *    `extrasAfter`), Apps (pinned, opens the suite launcher), the avatar. The avatar opens ONLY
 *    the account popover (real avatar, name, role, mode switch for trainer/admin, Profile);
 *    More holds only the overflowed entries: the foot extras collapse FIRST (all at once,
 *    listed as their own group), then the nav entries from the end. A hidden bell with unread
 *    lights More. Apps and the avatar never collapse;
 *  - the app's accent comes from the wrapping `.app-*` theme (accent-ramp), not from here.
 *
 * Shown from 720px up (the real apps' swap width, unchanged); below it the app mounts
 * `SuiteTabBar` instead.
 */
import { useT } from '../i18n';
import { useCoachT } from '../i18n/coach';
import { SpotterMark } from '../brand/SpotterMark';
import { badgeText } from './ui/Badge';
import { COACH_WIDE_BREAKPOINT, useMinWidth } from './ui/breakpoints';
import { MoreMenu } from './ui/MoreMenu';
import { Rail } from './ui/Rail';
import type { RailEntry, RailFootEntry } from './ui/railOverflow';
import { SuiteRailFoot } from './suite/SuiteRailFoot';
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
  /** The bell; omitted = no bell in the foot. */
  onOpenNotifications?: () => void;
  /** Profile row of the account popover. */
  onOpenProfile?: () => void;
  notifUnread?: number;
  /** App-specific foot extras above the bell (Gym: conditions shield, mastery). */
  extrasBefore?: RailFootEntry[];
  /** App-specific foot extras between the bell and Apps (Gym: admin settings). */
  extrasAfter?: RailFootEntry[];
  /** Warning dot on the avatar (Gym: offline / sync failed). No dot while all is well. */
  syncColor?: string;
}) {
  const { t } = useT();
  const { c } = useCoachT();
  const wide = useMinWidth(COACH_WIDE_BREAKPOINT);

  const entries: RailEntry[] = nav.map((x) => ({
    id: x.id,
    label: x.label,
    icon: x.icon,
    active: activeId === x.id,
    onSelect: () => onNav(x.id),
    ...(x.live ? { live: true, liveLabel: x.liveLabel } : {}),
    ...(x.count ? { count: x.count, countLabel: x.countLabel } : {}),
  }));

  const footEntries: RailFootEntry[] = [
    ...(extrasBefore ?? []),
    ...(onOpenNotifications
      ? [
          {
            id: 'notifications',
            label: t.notifTitle,
            icon: 'bell',
            fill: true,
            onSelect: onOpenNotifications,
            badge: badgeText(notifUnread) || null,
            count: notifUnread,
            countLabel: c.unread(notifUnread),
          },
        ]
      : []),
    ...(extrasAfter ?? []),
  ];

  return (
    <Rail
      brand={<SpotterMark size={40} variant="sidebar" />}
      labelled={wide}
      compact={!wide}
      ariaLabel={c.navLandmark}
      overflow={{
        entries,
        footEntries,
        moreLabel: c.navMore,
        moreCountLabel: c.unread,
        renderMenu: ({ hiddenNav, hiddenFoot, open, onClose, anchorRef }) => (
          <MoreMenu
            presentation="popover"
            open={open}
            onClose={onClose}
            anchorRef={anchorRef}
            title={c.navMore}
            items={hiddenNav}
            extraItems={hiddenFoot}
          />
        ),
      }}
      foot={
        <>
          <SuiteRailFoot
            app={app}
            onOpenShell={onOpenShell}
            onOpenProfile={onOpenProfile}
            warnColor={syncColor}
          />
        </>
      }
    />
  );
}
