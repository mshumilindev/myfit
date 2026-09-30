/**
 * People — the accounts & profiles app. A full-screen "sub-app" inside Spotter
 * with a graphite + silver skin, reusing the existing Trainer (clients), Admin
 * (users) and Profile views. The silver re-skin is pure CSS: the `.app-roster`
 * wrapper overrides the accent tokens, so every reused view turns silver for
 * free. Chrome mirrors the Gym / Apex apps: a brand header (wordmark + bell) and
 * a bottom nav ending in Apps on phones, the shared icon rail on desktop.
 *
 * Which tabs show depends on role, matching the old in-Gym menu: a trainer sees
 * Clients + Me, an admin sees Users + Me, a member just Me.
 */
import { TabBar } from '../components/ui/TabBar';
import { BrandBar, BellButton } from '../components/ui/BrandBar';
import { useState } from 'react';
import { useT } from '../i18n';
import type { Shell } from '../App';
import { AppRail } from '../components/AppRail';
import { TrainerView } from './TrainerView';
import { AdminView } from './AdminView';
import { ProfileView } from './ProfileView';
import { NotificationsView } from './NotificationsView';
import type { Notif, NotifState } from '../notifications';

export type RosterTab = 'clients' | 'users' | 'me' | 'feed';
type Role = 'trainer' | 'admin' | 'member';

/** The primary (non-feed) tab a given role lands on. */
export function rosterHomeTab(role: Role): RosterTab {
  if (role === 'trainer') return 'clients';
  if (role === 'admin') return 'users';
  return 'me';
}

export function RosterApp({
  role,
  now,
  tab,
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
  // A specific person's profile, opened from the Clients / Users list.
  const [profileId, setProfileId] = useState<string | null>(null);

  const appLabel = role === 'trainer' ? t.trClientsTab : role === 'admin' ? t.adminPeople : t.navMe;

  const nav: { id: RosterTab; icon: string; label: string }[] = [];
  if (role === 'trainer') nav.push({ id: 'clients', icon: 'user-focus', label: t.trClientsTab });
  if (role === 'admin') nav.push({ id: 'users', icon: 'shield-check', label: t.adminPeople });
  nav.push({ id: 'me', icon: 'user', label: t.navMe });

  const openTab = (next: RosterTab) => {
    setProfileId(null);
    onTab(next);
  };

  return (
    <div className="app-roster apex-app">
      <AppRail
        nav={nav}
        activeId={tab === 'feed' ? null : tab}
        onNav={(id) => openTab(id as RosterTab)}
        onOpenShell={onOpenShell}
        onOpenNotifications={() => openTab('feed')}
        onOpenProfile={() => openTab('me')}
        notifUnread={notifUnread}
      />
      <div className="apex-col">
        <BrandBar
          header
          app={appLabel}
          onApp={onOpenShell}
          appLabel={t.shellSwitch}
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
          ) : tab === 'clients' ? (
            <TrainerView onOpenProfile={setProfileId} onOpenMe={() => openTab('me')} />
          ) : (
            <AdminView onOpenProfile={setProfileId} />
          )}
        </div>

        <TabBar
          tabs
          activeFill
          items={nav.map((x) => ({ ...x, active: tab === x.id }))}
          onSelect={(id) => openTab(id)}
          apps={{ label: t.appsTab, ariaLabel: t.shellSwitch, onClick: onOpenShell }}
        />
      </div>
    </div>
  );
}
