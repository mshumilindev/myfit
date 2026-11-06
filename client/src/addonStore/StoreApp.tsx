/**
 * Add-on Store (SPO-513) — full-screen sub-app at `#/store`, on its own kit (`store-kit/`, ADR 015): header +
 * tab bar on a phone, sidebar on a wide screen. Five places: Discover, Apps, Add-ons, Selected, Installed, plus an
 * item page and live search.
 */
import { useEffect, useMemo, useState } from 'react';
import { getRole, getUsername } from '../api';
import { addonById } from '../addons/manifest';
import type { Role } from '../api';
import { useEnabledAddons } from '../addons/enabledSet';
import { useQueuedAddons } from '../addons/queue';
import { initialsOf } from '../components/ui/Avatar';
import { useAddonStoreT } from '../i18n/addonStore';
import { currentHash, setHash } from '../route';
import {
  SkAvatar,
  SkBackground,
  SkBar,
  SkHeader,
  SkIcon,
  SkNavItem,
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
import { ItemPage } from './ItemPage';
import { Addons, Apps, Discover, Search, Selected } from './StoreScreens';
import { ItemAction, RemoveButton, type StoreCtx } from './storeItems';
import {
  parseStoreHash,
  STORE_FALLBACK_HASH,
  storeHash,
  storeTabFromHash,
  type StoreTab,
  type StoreView,
} from './storeRoute';

const NAV: Array<{ tab: StoreTab; icon: SkIconName }> = [
  { tab: 'discover', icon: 'disc' },
  { tab: 'apps', icon: 'apps' },
  { tab: 'addons', icon: 'addons' },
  { tab: 'selected', icon: 'queue' },
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

  // Moving by a tab or the sidebar replaces the place; opening something from a screen pushes it, so Back can return.
  const goTab = (v: string) => {
    setPushed(null);
    setHash(storeHash(v as StoreView['view']), true);
  };
  const go = (v: string, id?: string) => {
    if (v !== 'item' && v !== 'search' && storeTabFromHash(currentHash()))
      setPushed({ target: v, from: storeTabFromHash(currentHash()) as StoreTab });
    setHash(storeHash(v as StoreView['view'], id), false);
  };
  const ctx: StoreCtx = useMemo(
    () => ({ st, enabled, queued, open: (id) => go('item', id) }),
    [st, enabled, queued],
  );

  const label: Record<StoreTab, string> = {
    discover: st.tabDiscover,
    apps: st.tabApps,
    addons: st.tabAddons,
    selected: st.tabSelected,
    installed: st.tabInstalled,
  };
  const view = route.view;
  const tab: StoreTab | null = view === 'item' || view === 'search' ? null : view;
  const title = view === 'search' ? st.searchTitle : view === 'item' ? '' : label[view];
  const name = getUsername() ?? '';
  const initials = initialsOf(name || '?');
  const showTray = queued.length > 0 && view !== 'selected' && view !== 'search';
  const isRoot = tab !== null;
  const itemM = view === 'item' ? addonById(route.id) : undefined;

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
  const exit = () => setHash(STORE_FALLBACK_HASH);
  const avatar = <SkAvatar initials={initials} label={name || st.title} onClick={onOpenProfile} />;

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
                count={
                  n.tab === 'selected'
                    ? queued.length
                    : n.tab === 'installed'
                      ? enabled.size
                      : undefined
                }
                onClick={() => goTab(n.tab)}
              />
            ))}
          </SkSidebar>
        }
        header={
          (isRoot || view === 'search') && !(pushed && pushed.target === view) ? (
            <SkHeader
              title={title}
              avatar={avatar}
              onExit={exit}
              exitLabel={st.backToSpotter}
              exitIcon={icon('x')}
            />
          ) : (
            <SkHeader
              onBack={() => {
                setPushed(null);
                window.history.back();
              }}
              backLabel={pushed && pushed.target === view ? label[pushed.from] : label[lastTab]}
              backIcon={icon('back')}
              avatar={avatar}
              onExit={exit}
              exitLabel={st.backToSpotter}
              exitIcon={icon('x')}
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
              dot: n.tab === 'selected' && queued.length > 0,
            }))}
          />
        }
        bar={
          itemM && !itemM.soon ? (
            <SkBar>
              {enabled.has(itemM.id) && <RemoveButton id={itemM.id} st={st} />}
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
        {view !== 'item' && (
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
        {view === 'discover' && <Discover role={role} ctx={ctx} go={go} />}
        {view === 'apps' && <Apps role={role} ctx={ctx} />}
        {view === 'addons' && <Addons role={role} ctx={ctx} />}
        {view === 'selected' && <Selected ctx={ctx} go={go} />}
        {view === 'installed' && <Installed ctx={ctx} go={go} />}
        {view === 'item' && <ItemPage id={route.id} ctx={ctx} go={go} />}
        {view === 'search' && <Search role={role} ctx={ctx} query={query} setQuery={setQuery} />}
      </SkShell>
    </div>
  );
}
