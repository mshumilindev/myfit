/**
 * People — the accounts & profiles app. A full-screen "sub-app" inside Spotter
 * with a graphite + silver skin, reusing the existing Admin (users) and Profile
 * views. The silver re-skin is pure CSS: the `.app-roster`
 * wrapper overrides the accent tokens, so every reused view turns silver for
 * free. Chrome mirrors the Gym / Apex apps: a brand header (wordmark + bell) and
 * a bottom nav ending in Apps on phones, the shared icon rail on desktop.
 *
 * Two separate things share this chrome (SPO-141): Users (user management, admin only) and Me (the own
 * profile & account, every role, reached from the avatar → Profile). They never mix in one nav. A non-admin
 * who lands on `users` (typed URL, saved route) is redirected to Me and the admin view is never rendered.
 */
import { SuiteTabBar } from '../components/SuiteTabBar';
import { useMinWidth, APP_BREAKPOINT } from '../components/ui/breakpoints';
import { BrandBar, BellButton } from '../components/ui/BrandBar';
import { BrandAccount } from '../components/suite/BrandAccount';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { Shell } from '../App';
import { AppRail } from '../components/AppRail';
import { AdminView } from './AdminView';
import { ProfileView } from './ProfileView';
import { NotificationsView } from './NotificationsView';
import type { Notif, NotifState } from '../notifications';

import { guardRosterTab, rosterHomeTab, rosterMode, type RosterRole } from './rosterAccess';

export type { RosterTab } from './rosterAccess';
import type { RosterTab } from './rosterAccess';
import { SUITE_ICON, SUITE_TONE } from '../components/suite/suiteTone';
type Role = RosterRole;

export function RosterApp({
  role,
  now,
  tab: rawTab,
  onTab,
  shell,
  onOpenShell,
  notifs,
  notifState,
  notifUnread,
  onNotifSeen,
  onNotifMarkAll,
}: {
  role: Role;
  now: number;
  tab: RosterTab;
  onTab: (t: RosterTab) => void;
  shell: Shell;
  onOpenShell: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
}) {
  const { t } = useT();
  const desktop = useMinWidth(APP_BREAKPOINT);
  // A specific person's profile, opened from the Clients / Users list.
  const [profileId, setProfileId] = useState<string | null>(null);

  // Defence in depth: whatever tab the router hands over, a non-admin never gets `users`.
  const tab = guardRosterTab(rawTab, role);
  useEffect(() => {
    if (tab !== rawTab) onTab(tab);
  }, [tab, rawTab, onTab]);
  const mode = rosterMode(tab, role);

  const appLabel = mode === 'users' ? t.adminPeople : t.navMe;

  // One item per screen: the admin's Users and everyone's Me are separate, never two tabs of one app.
  const nav: { id: RosterTab; icon: string; label: string }[] =
    mode === 'users'
      ? [{ id: 'users', icon: 'shield-check', label: t.adminPeople }]
      : [{ id: 'me', icon: 'user', label: t.navMe }];

  const openTab = (next: RosterTab) => {
    setProfileId(null);
    onTab(next);
  };

  return (
    <div className="app-roster apex-app">
      {desktop && (
        <AppRail
          app="roster"
          nav={nav}
          activeId={tab === 'feed' ? null : tab}
          onNav={(id) => openTab(id as RosterTab)}
          onOpenShell={onOpenShell}
          onOpenNotifications={() => openTab('feed')}
          onOpenProfile={() => openTab('me')}
          notifUnread={notifUnread}
        />
      )}
      <div className="apex-col">
        <BrandBar
          avatar={(hidden) => (
            <BrandAccount app="roster" hidden={hidden} onOpenProfile={() => openTab('me')} />
          )}
          header
          app={appLabel}
          onApp={onOpenShell}
          appLabel={t.shellSwitch}
          tone={SUITE_TONE.roster}
          icon={SUITE_ICON.roster}
          actions={
            <>
              <BellButton
                label={t.feedTitle}
                onClick={() => openTab('feed')}
                active={tab === 'feed'}
                count={tab !== 'feed' ? notifUnread : 0}
              />
            </>
          }
        />

        <div className="apex-body">
          {profileId ? (
            <ProfileView userId={profileId} shell={shell} onClose={() => setProfileId(null)} />
          ) : tab === 'feed' ? (
            <NotificationsView
              embedded
              title={t.feedTitle}
              notifs={notifs}
              now={now}
              state={notifState}
              onSeen={onNotifSeen}
              onMarkAll={onNotifMarkAll}
              onClose={() => openTab(rosterHomeTab(role))}
            />
          ) : tab === 'me' ? (
            <ProfileView
              userId="me"
              shell={shell}
              embedded
              onClose={() => openTab(rosterHomeTab(role))}
            />
          ) : tab === 'users' ? (
            <AdminView onOpenProfile={setProfileId} />
          ) : null}
        </div>

        {!desktop && (
          <SuiteTabBar
            app="roster"
            noMore
            noAccount
            tabs
            activeFill
            items={nav.map((x) => ({ ...x, active: tab === x.id }))}
            onSelect={(id) => openTab(id)}
          />
        )}
      </div>
    </div>
  );
}
