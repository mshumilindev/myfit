/**
 * Add-on Store (SPO-513) — full-screen sub-app at `#/store`. Chrome is the shared suite header (BrandBar +
 * avatar); the three tabs are a kit Segmented that follows the address.
 */
import { BrandBar } from '../components/ui/BrandBar';
import { PageHead } from '../components/ui/PageHead';
import { Segmented } from '../components/ui/Segmented';
import { BrandAccount } from '../components/suite/BrandAccount';
import { useEffect, useState } from 'react';
import type { Role } from '../api';
import { currentHash, setHash } from '../route';
import { useAddonStoreT } from '../i18n/addonStore';
import './store.css';
import { StoreBrowse } from './StoreBrowse';
import { StoreDiscover } from './StoreDiscover';
import { StoreInstalled } from './StoreInstalled';
import { STORE_FALLBACK_HASH, storeHash, storeTabFromHash, type StoreTab } from './storeRoute';

export function StoreApp({ role, onOpenProfile }: { role: Role; onOpenProfile: () => void }) {
  const { st } = useAddonStoreT();
  const [tab, setTab] = useState<StoreTab>(() => storeTabFromHash(currentHash()));
  useEffect(() => {
    const on = () => setTab(storeTabFromHash(currentHash()));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const close = () => setHash(STORE_FALLBACK_HASH);
  const pick = (next: StoreTab) => setHash(storeHash(next), true);

  return (
    <div className="app-store apex-app">
      <div className="apex-col">
        <BrandBar
          header
          app={st.title}
          onApp={close}
          appLabel={st.backToSpotter}
          tone="accent"
          icon="plugs"
          avatar={(hidden) => (
            <BrandAccount app="gym" hidden={hidden} onOpenProfile={onOpenProfile} />
          )}
        />
        <div className="apex-body">
          <div className="apex-scroll">
            <div className="as-page">
              <PageHead back={{ label: st.back, onClick: close }} title={st.title} />
              <Segmented<StoreTab>
                tabs
                fill
                label={st.tabsLabel}
                value={tab}
                onChange={pick}
                options={[
                  { value: 'discover', label: st.tabDiscover },
                  { value: 'browse', label: st.tabBrowse },
                  { value: 'installed', label: st.tabInstalled },
                ]}
              />
              {tab === 'discover' && <StoreDiscover role={role} />}
              {tab === 'browse' && <StoreBrowse role={role} />}
              {tab === 'installed' && <StoreInstalled role={role} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
