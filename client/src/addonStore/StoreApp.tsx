/**
 * Add-on Store (SPO-513) — full-screen sub-app at `#/store`, on its own kit (`store-kit/`, ADR 015): header +
 * tab bar on a phone, sidebar on a wide screen. Five places: Discover, Apps, Add-ons, Themes, Installed, plus an
 * item page and live search.
 */
import { useEffect, useMemo, useState } from 'react';
import { currentUid, getRole, getUsername } from '../api';
import { defaultAppHash } from '../addons/defaultApp';
import { addonById } from '../addons/manifest';
import type { Role } from '../api';
import { useEnabledAddons } from '../addons/enabledSet';
import { retryInstall, undoInstall, useInstallRun } from '../addons/installRun';
import { useOnline } from '../addons/useOnline';
import { useQueuedAddons } from '../addons/queue';
import { initialsOf, useOwnAvatarUrl } from '../components/Avatar';
import { useAddonStoreT } from '../i18n/addonStore';
import { currentHash, setHash } from '../route';
import {
  SkAvatar,
  SkBackground,
  SkBar,
  SkBtn,
  SkHeader,
  SkIcon,
  SkNavItem,
  SkOfflineBar,
  SkSearchField,
  SkSectionLink,
  SkShell,
  SkSidebar,
  SkSidebarUser,
  SkTabBar,
  SkTray,
  type SkIconName,
} from '../store-kit';
import './screens.css';
import { Installed } from './InstalledScreen';
import { InstallDone, Installing } from './InstallFlow';
import { ManageScreen } from './ManageScreen';
import { ItemPage } from './ItemPage';
import { Addons, Apps, Discover, Search, Selected, Themes } from './StoreScreens';
import { RemoveButton } from './RemoveSheet';
import { ItemAction, itemName, type StoreCtx } from './storeItems';
import {
  parseStoreHash,
  storeHash,
  storeTabFromHash,
  type StoreTab,
  type StoreView,
} from './storeRoute';

const NAV: Array<{ tab: StoreTab; icon: SkIconName }> = [
  { tab: 'discover', icon: 'disc' },
  { tab: 'apps', icon: 'apps' },
  { tab: 'addons', icon: 'addons' },
  { tab: 'themes', icon: 'brush' },
  { tab: 'installed', icon: 'inst' },
];

export function StoreApp({ role, onOpenProfile }: { role: Role; onOpenProfile: () => void }) {
  const { st } = useAddonStoreT();
  const [route, setRoute] = useState<StoreView>(() => parseStoreHash(currentHash()));
  const [query, setQuery] = useState('');
  /** A root place opened from another one (a tile or link): shows Back to where it came from. */
  const [pushed, setPushed] = useState<{ target: string; from: StoreTab } | null>(null);
  const [lastTab, setLastTab] = useState<StoreTab>(
    () => storeTabFromHash(currentHash()) ?? 'discover',
  );
  const enabled = useEnabledAddons();
  const run = useInstallRun();
  const online = useOnline();
  const queued = useQueuedAddons();
  useEffect(() => {
    const on = () => {
      setRoute(parseStoreHash(currentHash()));
      const t = storeTabFromHash(currentHash());
      if (t) setLastTab(t);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // The run moves the screen on: finished → All set; nothing running (a reload, or after Undo) → back to Discover.
  useEffect(() => {
    const v = route.view;
    if (v === 'installing' && run.status === 'done') setHash(storeHash('done'), true);
    else if ((v === 'installing' || v === 'done') && run.status === 'idle')
      setHash(storeHash('discover'), true);
  }, [route.view, run.status]);

  useEffect(() => {
    if (route.view === 'manage' && !enabled.has(route.id)) setHash(storeHash('installed'), true);
  }, [route, enabled]);

  // Moving by a tab or the sidebar replaces the place; opening something from a screen pushes it, so Back can return.
  const goTab = (v: string) => {
    setPushed(null);
    setHash(storeHash(v as StoreView['view']), true);
  };
  const go = (v: string, id?: string) => {
    if (v !== 'item' && v !== 'manage' && v !== 'search' && storeTabFromHash(currentHash()))
      setPushed({ target: v, from: storeTabFromHash(currentHash()) as StoreTab });
    setHash(storeHash(v as StoreView['view'], id), false);
  };
  const ctx: StoreCtx = useMemo(
    () => ({ st, enabled, queued, online, open: (id) => go('item', id) }),
    [st, enabled, queued, online],
  );

  const label: Record<StoreTab, string> = {
    discover: st.tabDiscover,
    apps: st.tabApps,
    addons: st.tabAddons,
    themes: st.tabThemes,
    installed: st.tabInstalled,
  };
  const view = route.view;
  const runView = view === 'installing' || view === 'done';
  const tab: StoreTab | null =
    view === 'item' || view === 'manage' || view === 'search' || view === 'selected' || runView
      ? null
      : view;
  const title =
    view === 'search'
      ? st.searchTitle
      : view === 'selected'
        ? st.tabSelected
        : tab
          ? label[tab]
          : '';
  const name = getUsername() ?? '';
  const initials = initialsOf(name || '?');
  const photo = useOwnAvatarUrl(currentUid() ?? undefined) ?? undefined;
  const showTray = queued.length > 0 && view !== 'selected' && view !== 'search' && !runView;
  const isRoot = tab !== null;
  const itemM = view === 'item' ? addonById(route.id) : undefined;
  const manageM = view === 'manage' ? addonById(route.id) : undefined;

  const search = (
    <SkSearchField
      value={query}
      placeholder={st.search}
      clearLabel={st.searchClear}
      onFocus={() => view !== 'search' && go('search')}
      onChange={(v) => {
        setQuery(v);
        if (view !== 'search') go('search');
      }}
      onClear={() => setQuery('')}
      autoFocus={view === 'search'}
    />
  );

  const icon = (n: SkIconName) => <SkIcon name={n} />;
  const exit = () => setHash(defaultAppHash(getRole()));
  const avatar = (
    <SkAvatar initials={initials} src={photo} label={name || st.title} onClick={onOpenProfile} />
  );

  return (
    <div className="sk-root sk-app" data-store-role={role || getRole()}>
      <SkBackground />
      <SkShell
        sidebar={
          <SkSidebar
            title={st.title}
            label={st.tabsLabel}
            back={<SkNavItem icon={icon('back')} label={st.backToSpotter} onClick={exit} />}
            user={
              <SkSidebarUser
                avatar={
                  <SkAvatar
                    initials={initials}
                    src={photo}
                    label={name || st.title}
                    onClick={onOpenProfile}
                    size={40}
                  />
                }
                name={name}
                role={getRole()}
              />
            }
          >
            {NAV.map((n) => (
              <SkNavItem
                key={n.tab}
                icon={icon(n.icon)}
                label={label[n.tab]}
                active={tab === n.tab}
                count={n.tab === 'installed' ? enabled.size : undefined}
                onClick={() => goTab(n.tab)}
              />
            ))}
          </SkSidebar>
        }
        header={
          runView ? (
            <SkHeader
              title=""
              avatar={avatar}
              onExit={exit}
              exitLabel={st.backToSpotter}
              exitIcon={icon('back')}
              exitText="Spotter"
            />
          ) : (isRoot || view === 'search') && !(pushed && pushed.target === view) ? (
            <SkHeader
              title={title}
              avatar={avatar}
              onExit={exit}
              exitLabel={st.backToSpotter}
              exitIcon={icon('back')}
              exitText="Spotter"
            />
          ) : (
            <SkHeader
              onBack={() => {
                // Back goes exactly where its label says (never to whatever the history happens to hold).
                const target = pushed && pushed.target === view ? pushed.from : lastTab;
                setPushed(null);
                setHash(storeHash(target), true);
              }}
              backLabel={pushed && pushed.target === view ? label[pushed.from] : label[lastTab]}
              backIcon={icon('back')}
              avatar={avatar}
              onExit={exit}
              exitLabel={st.backToSpotter}
              exitIcon={icon('back')}
              exitText="Spotter"
            />
          )
        }
        tabBar={
          <SkTabBar
            label={st.tabsLabel}
            active={tab}
            onSelect={(id) => goTab(id)}
            tabs={NAV.map((n) => ({
              id: n.tab,
              label: label[n.tab],
              icon: icon(n.icon),
            }))}
          />
        }
        bar={
          view === 'installing' ? (
            <SkBar>
              <SkBtn kind="ghost" size="l" onClick={() => goTab('discover')}>
                {st.keepBrowsing}
              </SkBtn>
            </SkBar>
          ) : view === 'done' ? (
            <SkBar>
              <SkBtn
                kind="ghost"
                size="l"
                onClick={() => {
                  undoInstall();
                  goTab('selected');
                }}
              >
                {st.undo}
              </SkBtn>
              <SkBtn kind="pri" size="l" onClick={exit}>
                {st.goToToday}
              </SkBtn>
            </SkBar>
          ) : manageM ? (
            <SkBar>
              <RemoveButton
                id={manageM.id}
                ctx={ctx}
                kind="bad"
                size="l"
                label={st.removeName(itemName(st, manageM.id))}
                onRemoved={() => goTab('installed')}
              />
            </SkBar>
          ) : itemM && !itemM.soon ? (
            <SkBar className="as-item-bar">
              {enabled.has(itemM.id) && <RemoveButton id={itemM.id} ctx={ctx} />}
              <ItemAction m={itemM} ctx={ctx} size="l" lead />
            </SkBar>
          ) : undefined
        }
        tray={
          showTray ? (
            <SkTray
              label={st.itemsCount(queued.length)}
              actionLabel={st.review}
              onAction={() => go('selected')}
            />
          ) : undefined
        }
      >
        {view !== 'item' && view !== 'manage' && !runView && (
          <div className="as-main-head">
            <h1
              className={`sk-t-h1d as-desk-title${pushed && pushed.target === view ? ' as-title-pushed' : ''}`}
            >
              {title}
            </h1>
            {view !== 'installed' && (
              <div
                className={`as-search-wrap${view === 'discover' || view === 'search' ? '' : ' as-search-wide'}`}
              >
                {search}
                {view === 'search' && (
                  <SkSectionLink
                    onClick={() => {
                      // Cancel closes the search and returns to the store place it was opened from — never out of the store.
                      setQuery('');
                      setHash(storeHash(lastTab), true);
                    }}
                  >
                    {st.cancel}
                  </SkSectionLink>
                )}
              </div>
            )}
          </div>
        )}
        {!online && !runView && (
          <SkOfflineBar className="sk-mb16" icon={<SkIcon name="bell" />} title={st.offlineTitle}>
            {st.offlineBody}
          </SkOfflineBar>
        )}
        {view === 'discover' && <Discover role={role} ctx={ctx} go={go} />}
        {view === 'apps' && <Apps role={role} ctx={ctx} />}
        {view === 'addons' && <Addons role={role} ctx={ctx} />}
        {view === 'themes' && <Themes role={role} ctx={ctx} />}
        {view === 'selected' && <Selected ctx={ctx} go={go} />}
        {view === 'installed' && <Installed ctx={ctx} go={go} />}
        {view === 'installing' && (
          <Installing ctx={ctx} run={run} onRetry={() => void retryInstall()} />
        )}
        {view === 'done' && <InstallDone ctx={ctx} ids={run.ids} />}
        {view === 'manage' && <ManageScreen id={route.id} ctx={ctx} />}
        {view === 'item' && <ItemPage id={route.id} ctx={ctx} go={go} />}
        {view === 'search' && <Search role={role} ctx={ctx} query={query} setQuery={setQuery} />}
      </SkShell>
    </div>
  );
}
