/**
 * Apex — the gamification app. A full-screen "sub-app" inside Spotter with its
 * own amethyst skin, reusing the existing derived views (Challenges,
 * Standards→Ranks, Feats→Awards, Notifications→Feed) plus a Home overview. The
 * amethyst re-skin is pure CSS: the `.app-apex` wrapper overrides the accent
 * tokens, so every reused component turns violet for free.
 *
 * Chrome mirrors the Gym app exactly: on phones a top brand header (wordmark +
 * bell) and a bottom nav ending in Apps; on desktop the shared icon rail. The
 * Feed (notifications) is reached via the bell, not a nav tab.
 */
import { useMemo } from 'react';
import { useT } from '../i18n';
import { Icon, LanguageSelector } from '../ui';
import type { StoreState } from '../store';
import { AppRail } from '../components/AppRail';
import { ChallengesView } from './ChallengesView';
import { StandardsView } from '../components/StandardsView';
import { FeatsView } from '../components/FeatsView';
import { NotificationsView } from './NotificationsView';
import { ApexHome } from './ApexHome';
import type { Notif, NotifState } from '../notifications';

export type ApexTab = 'home' | 'challenges' | 'ranks' | 'awards' | 'feed';

export const APEX_TABS: ApexTab[] = ['home', 'challenges', 'ranks', 'awards', 'feed'];

export function ApexApp({
  store,
  now,
  tab,
  onTab,
  onOpenShell,
  onOpenProfile,
  notifs,
  notifState,
  notifUnread,
  onNotifSeen,
  onNotifMarkAll,
}: {
  store: StoreState;
  now: number;
  tab: ApexTab;
  onTab: (t: ApexTab) => void;
  onOpenShell: () => void;
  onOpenProfile: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
}) {
  const { t } = useT();
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );

  // Four primary tabs; Apps closes the set on mobile, Feed lives on the bell.
  const nav: { id: ApexTab; icon: string; label: string }[] = [
    { id: 'home', icon: 'house', label: t.apexHomeTab },
    { id: 'challenges', icon: 'flag-banner', label: t.challengesTab },
    { id: 'ranks', icon: 'trophy', label: t.apexRanksTab },
    { id: 'awards', icon: 'medal', label: t.apexAwardsTab },
  ];

  return (
    <div className="app-apex apex-app">
      <AppRail
        nav={nav}
        activeId={tab === 'feed' ? null : tab}
        onNav={(id) => onTab(id as ApexTab)}
        onOpenShell={onOpenShell}
        onOpenNotifications={() => onTab('feed')}
        onOpenProfile={onOpenProfile}
        notifUnread={notifUnread}
      />
      <div className="apex-col">
        <header className="app-brand apex-head">
          <div className="app-brand-lead">
            <span className="app-brand-word">spotter</span>
            <button className="app-brand-app" onClick={onOpenShell} aria-label={t.shellSwitch}>
              {t.apexName}
            </button>
          </div>
          <div className="app-brand-actions">
            <button className="app-bell" onClick={() => onTab('feed')} aria-label={t.feedTitle}>
              <Icon
                name="bell"
                weight={tab === 'feed' ? 'fill' : undefined}
                className="app-brand-icon"
              />
              {notifUnread > 0 && tab !== 'feed' && (
                <span className="app-bell-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
              )}
            </button>
            <LanguageSelector />
          </div>
        </header>

        <div className="apex-body">
          {tab === 'feed' ? (
            <NotificationsView
              embedded
              title={t.feedTitle}
              notifs={notifs}
              now={now}
              state={notifState}
              onSeen={onNotifSeen}
              onMarkAll={onNotifMarkAll}
              onClose={() => onTab('home')}
            />
          ) : (
            <div className="apex-scroll">
              {tab === 'home' && <ApexHome store={store} now={now} notifs={notifs} onTab={onTab} />}
              {tab === 'challenges' && <ChallengesView store={store} />}
              {tab === 'ranks' && (
                <div className="apex-page">
                  <div className="apex-title">
                    <h2 className="title-26">{t.ranksTitle}</h2>
                    <span className="apex-title-sub">{t.ranksSub}</span>
                  </div>
                  <StandardsView finished={finished} body={store.bodyMetrics} />
                </div>
              )}
              {tab === 'awards' && (
                <div className="apex-page">
                  <div className="apex-title">
                    <h2 className="title-26">{t.awardsTitle}</h2>
                  </div>
                  <FeatsView
                    finished={finished}
                    body={store.bodyMetrics}
                    sub="achievements"
                    onSub={() => {}}
                    hideSubtabs
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="apex-nav" role="tablist">
          {nav.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              className={tab === x.id ? 'active' : ''}
              onClick={() => onTab(x.id)}
            >
              <Icon name={x.icon} weight={tab === x.id ? 'fill' : undefined} />
              <span>{x.label}</span>
            </button>
          ))}
          <button className="apex-nav-apps" onClick={onOpenShell} aria-label={t.shellSwitch}>
            <Icon name="squares-four" />
            <span>{t.appsTab}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
