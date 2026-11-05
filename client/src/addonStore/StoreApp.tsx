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
import { SkAvatar, SkBtn, SkIcon, SkSearchField, cx } from '../store-kit/parts';
import type { SkIconName } from '../store-kit/icons';
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

  return (
    <div className="sk-root" data-store-role={role || getRole()}>
      <div className="sk-shell">
        <aside className="sk-side" aria-label={st.tabsLabel}>
          <div className="sk-rowf sk-g12 sk-mb16" style={{ height: 44, padding: '0 12px' }}>
            <span className="sk-t-h2">{st.title}</span>
          </div>
          <nav>
            {NAV.map((n) => (
              <button
                key={n.tab}
                type="button"
                className={cx('sk-sn', tab === n.tab && 'sk-on')}
                aria-current={tab === n.tab ? 'page' : undefined}
                onClick={() => go(n.tab)}
                style={{ width: '100%' }}
              >
                <SkIcon name={n.icon} />
                <span>{label[n.tab]}</span>
                {n.tab === 'selected' && queued.length > 0 && (
                  <span className="sk-cnt">{queued.length}</span>
                )}
                {n.tab === 'installed' && enabled.size > 0 && (
                  <span className="sk-cnt">{enabled.size}</span>
                )}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="sk-sn sk-mt16"
            onClick={() => setHash(STORE_FALLBACK_HASH)}
          >
            <SkIcon name="back" />
            <span>{st.backToSpotter}</span>
          </button>
          <div className="sk-usr">
            <SkAvatar
              initials={initials}
              label={name || st.title}
              onClick={onOpenProfile}
              size={40}
            />
            <div className="sk-f1">
              <div className="sk-t-b sk-b6">{name}</div>
              <div className="sk-t-c">{getRole()}</div>
            </div>
          </div>
        </aside>
        <main className="sk-main">
          <header className="sk-hdr">
            {isRoot || view === 'search' ? (
              <h1 className="sk-t-h1">{title}</h1>
            ) : (
              <button type="button" className="sk-nav" onClick={() => window.history.back()}>
                <SkIcon name="back" />
                <span>{st.back}</span>
              </button>
            )}
            <div className="sk-hdr-end">
              <button
                type="button"
                className="sk-exit"
                aria-label={st.backToSpotter}
                title={st.backToSpotter}
                onClick={() => setHash(STORE_FALLBACK_HASH)}
              >
                <SkIcon name="x" />
              </button>
              <SkAvatar initials={initials} label={name || st.title} onClick={onOpenProfile} />
            </div>
          </header>
          <div className="sk-scroll">
            {view !== 'item' && (
              <div className="sk-main-head">
                <h1 className="sk-t-h1d sk-desk-title">{title}</h1>
                <div className="sk-search-wrap sk-rowf sk-g12">
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
            {view === 'search' && (
              <Search role={role} ctx={ctx} query={query} setQuery={setQuery} />
            )}
          </div>
        </main>
      </div>
      {showTray && (
        <div className="sk-tray" role="status">
          <div className="sk-f1">
            <b>{st.itemsCount(queued.length)}</b>
          </div>
          <SkBtn kind="inv" onClick={() => go('selected')}>
            {st.review}
          </SkBtn>
        </div>
      )}
      <nav className="sk-tabbar" aria-label={st.tabsLabel}>
        {NAV.map((n) => (
          <button
            key={n.tab}
            type="button"
            className={cx('sk-tab', tab === n.tab && 'sk-on')}
            aria-current={tab === n.tab ? 'page' : undefined}
            onClick={() => go(n.tab)}
          >
            <SkIcon name={n.icon} />
            {n.tab === 'selected' && queued.length > 0 && <i className="sk-dot" />}
            <span>{label[n.tab]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
