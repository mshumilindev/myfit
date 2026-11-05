/**
 * Add-on Store (SPO-513) — full-screen sub-app at `#/store`, on its own kit (`store-kit/`, ADR 015): header +
 * tab bar on a phone, sidebar on a wide screen. Five places: Discover, Apps, Add-ons, Selected, Installed, plus an
 * item page and live search.
 */
import { useEffect, useMemo, useState } from 'react';
import { getRole, getUsername } from '../api';
import type { Role } from '../api';
import { useEnabledAddons } from '../addons/enabledSet';
import { useQueuedAddons } from '../addons/queue';
import { initialsOf } from '../components/ui/Avatar';
import { useAddonStoreT } from '../i18n/addonStore';
import { currentHash, setHash } from '../route';
import {
  SkAvatar,
  SkBackground,
  SkBtn,
  SkHeader,
  SkIcon,
  SkNavItem,
  SkSearchField,
  SkShell,
  SkSidebar,
  SkSidebarUser,
  SkTabBar,
  SkTray,
  type SkIconName,
} from '../store-kit';
import './screens.css';
import { Addons, Apps, Discover, Installed, ItemPage, Search, Selected } from './StoreScreens';
import type { StoreCtx } from './storeItems';
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

  const go = (v: string, id?: string) =>
    setHash(storeHash(v as StoreView['view'], id), v !== 'item');
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
                onClick={() => go(n.tab)}
              />
            ))}
          </SkSidebar>
        }
        header={
          isRoot || view === 'search' ? (
            <SkHeader
              title={title}
              avatar={avatar}
              onExit={exit}
              exitLabel={st.backToSpotter}
              exitIcon={icon('x')}
            />
          ) : (
            <SkHeader
              onBack={() => window.history.back()}
              backLabel={st.back}
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
            onSelect={(id) => go(id)}
            tabs={NAV.map((n) => ({
              id: n.tab,
              label: label[n.tab],
              icon: icon(n.icon),
              dot: n.tab === 'selected' && queued.length > 0,
            }))}
          />
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
            <h1 className="sk-t-h1d as-desk-title">{title}</h1>
            <div className="as-search-wrap">
              {search}
              {view === 'search' && (
                <SkBtn
                  kind="ghost"
                  onClick={() => {
                    // Cancel closes the search and returns to the store place it was opened from — never out of the store.
                    setQuery('');
                    setHash(storeHash(lastTab), true);
                  }}
                >
                  {st.cancel}
                </SkBtn>
              )}
            </div>
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
