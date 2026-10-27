/**
 * The chrome the suite sub-apps (Apex, Nutrition) share: icon rail on desktop, brand bar with the notification bell,
 * the notifications feed in place of the body, the bottom tab bar on phones. The app supplies what differs: its tabs and
 * names, the body for the non-feed tabs (`children`), anything between body and tab bar (`afterBody`) and its sheets (`overlays`).
 */
import type { ReactNode } from 'react';
import { AppRail, type RailNavItem } from '../AppRail';
import { SuiteTabBar } from '../SuiteTabBar';
import { BrandBar, BellButton } from '../ui/BrandBar';
import { BrandAccount } from './BrandAccount';
import { SUITE_ICON, SUITE_TONE } from './suiteTone';
import type { SuiteApp } from './useSuiteAccount';
import { NotificationsView } from '../../views/NotificationsView';
import type { Notif, NotifState } from '../../notifications';

export function SuiteAppFrame({
  app,
  className,
  desktop,
  nav,
  tab,
  homeTab,
  onTab,
  names,
  onOpenShell,
  onOpenProfile,
  notifs,
  notifState,
  notifUnread,
  now,
  onNotifSeen,
  onNotifMarkAll,
  children,
  afterBody,
  overlays,
}: {
  app: Extract<SuiteApp, 'apex' | 'nutrition'>;
  /** The app's own root class, next to `apex-app`. */
  className: string;
  desktop: boolean;
  nav: RailNavItem[];
  /** The current tab id; 'feed' shows the notifications. */
  tab: string;
  /** Where closing the feed goes. */
  homeTab: string;
  onTab: (id: string) => void;
  /** appName: brand bar title · apps: label of the app switcher · feed: bell label and feed title. */
  names: { appName: string; apps: string; feed: string };
  onOpenShell: () => void;
  onOpenProfile: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  now: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
  children: ReactNode;
  afterBody?: ReactNode;
  overlays?: ReactNode;
}) {
  return (
    <div className={`${className} apex-app`}>
      {desktop && (
        <AppRail
          app={app}
          nav={nav}
          activeId={tab === 'feed' ? null : tab}
          onNav={onTab}
          onOpenShell={onOpenShell}
          onOpenNotifications={() => onTab('feed')}
          onOpenProfile={onOpenProfile}
          notifUnread={notifUnread}
        />
      )}
      <div className="apex-col">
        <BrandBar
          avatar={(hidden) => (
            <BrandAccount app={app} hidden={hidden} onOpenProfile={onOpenProfile} />
          )}
          header
          app={names.appName}
          onApp={onOpenShell}
          appLabel={names.apps}
          tone={SUITE_TONE[app]}
          icon={SUITE_ICON[app]}
          actions={
            <BellButton
              label={names.feed}
              onClick={() => onTab('feed')}
              active={tab === 'feed'}
              count={tab !== 'feed' ? notifUnread : 0}
            />
          }
        />

        <div className="apex-body">
          {tab === 'feed' ? (
            <NotificationsView
              embedded
              title={names.feed}
              notifs={notifs}
              now={now}
              state={notifState}
              onSeen={onNotifSeen}
              onMarkAll={onNotifMarkAll}
              onClose={() => onTab(homeTab)}
            />
          ) : (
            <div className="apex-scroll">{children}</div>
          )}
        </div>

        {afterBody}

        {!desktop && (
          <SuiteTabBar
            app={app}
            noMore
            tabs
            activeFill
            items={nav.map((x) => ({ ...x, active: tab === x.id }))}
            onSelect={onTab}
          />
        )}
      </div>
      {overlays}
    </div>
  );
}
