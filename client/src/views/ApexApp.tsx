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
import { useMemo, useState } from 'react';
import { fmtDayMonth, useT } from '../i18n';
import { Icon, LanguageSelector } from '../ui';
import type { StoreState } from '../store';
import { AppRail } from '../components/AppRail';
import { ChallengesView } from './ChallengesView';
import { StandardsView } from '../components/StandardsView';
import { FeatsView } from '../components/FeatsView';
import { NotificationsView } from './NotificationsView';
import { ApexHome } from './ApexHome';
import { StatShareSheet } from '../components/StatShareSheet';
import { computeStandards, type Sex } from '../standards';
import { computeFeats } from '../feats';
import type { StatShareModel } from '../data/shareCard';
import type { BodyMetrics } from '../types';
import type { Notif, NotifState } from '../notifications';

export type ApexTab = 'home' | 'challenges' | 'ranks' | 'awards' | 'feed';

export const APEX_TABS: ApexTab[] = ['home', 'challenges', 'ranks', 'awards', 'feed'];

function apxLatestWeight(body: BodyMetrics): number {
  if (!body?.weights?.length) return 0;
  return body.weights.slice().sort((a, b) => b.at - a.at)[0].weight;
}

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
  const { t, locale } = useT();
  const finished = useMemo(
    () => store.workouts.filter((w) => w.finishedAt !== null),
    [store.workouts],
  );

  const [share, setShare] = useState<{ model: StatShareModel; fileBase: string } | null>(null);
  const shareRanks = () => {
    const bodyKg = apxLatestWeight(store.bodyMetrics);
    const hasSex = store.bodyMetrics.sex === 'male' || store.bodyMetrics.sex === 'female';
    if (!hasSex || bodyKg === 0) return;
    const sex: Sex = store.bodyMetrics.sex === 'female' ? 'F' : 'M';
    const { results } = computeStandards(finished, bodyKg, sex);
    const trained = results.filter((r) => r.trained);
    const rows = trained
      .slice()
      .sort((a, b) => b.best - a.best)
      .slice(0, 6)
      .map((r) => {
        const tier = r.achievedIdx >= 0 ? r.tierIds[r.achievedIdx] : null;
        const label = tier ? (r.system === 'rank' ? t.rankShort[tier] : t.lvlShort[tier]) : null;
        const kg = `${Math.round(r.best)} kg`;
        return {
          lead: '🏅',
          name: r.name,
          detail: label ? `${label} · ${kg}` : kg,
          accent: !!label,
        };
      });
    setShare({
      model: {
        brand: 'spotter',
        kicker: t.ranksTitle,
        headline: t.apxRanksShareLine,
        hero: { value: String(trained.length), label: t.apxRanksUnit },
        rows,
        handle: 'spotter.app',
      },
      fileBase: 'spotter-standards',
    });
  };
  const shareAwards = () => {
    const res = computeFeats(finished);
    const all = Object.values(res.byGroup)
      .flat()
      .filter((a) => a.unlocked);
    const rows = all
      .slice()
      .sort((a, b) => (b.unlockAt ?? 0) - (a.unlockAt ?? 0))
      .slice(0, 6)
      .map((a) => ({
        lead: a.emoji,
        name: a.title,
        detail: a.unlockAt ? fmtDayMonth(a.unlockAt, locale) : '✓',
        accent: !a.unlockAt,
      }));
    setShare({
      model: {
        brand: 'spotter',
        kicker: t.awardsTitle,
        headline: t.apxAwardsShareLine,
        hero: { value: String(res.unlockedCount), label: t.apxAwardsUnit },
        rows,
        handle: 'spotter.app',
      },
      fileBase: 'spotter-awards',
    });
  };

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
                    <div className="apex-title-txt">
                      <h2 className="title-26">{t.ranksTitle}</h2>
                      <span className="apex-title-sub">{t.ranksSub}</span>
                    </div>
                    <button className="apx-share" onClick={shareRanks} aria-label={t.rcShare}>
                      <Icon name="export" />
                    </button>
                  </div>
                  <StandardsView finished={finished} body={store.bodyMetrics} />
                </div>
              )}
              {tab === 'awards' && (
                <div className="apex-page">
                  <div className="apex-title">
                    <h2 className="title-26">{t.awardsTitle}</h2>
                    <button className="apx-share" onClick={shareAwards} aria-label={t.rcShare}>
                      <Icon name="export" />
                    </button>
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
      {share && (
        <StatShareSheet
          model={share.model}
          fileBase={share.fileBase}
          onClose={() => setShare(null)}
        />
      )}
    </div>
  );
}
