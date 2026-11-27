import './catalogPromo.css';
import { getRole } from '../../api';
import { isAddonAllowed, useEnabledAddons } from '../../addons/enabledSet';
import { addonById } from '../../addons/manifest';
import { useAddonStoreT } from '../../i18n/addonStore';
import { storeHash } from '../../addonStore/storeRoute';
import { TileOf, kindBadge } from '../../addonStore/storeItems';
import { SkBento, SkBentoTile, SkBtn } from '../../store-kit';
import { setHash } from '../../route';

const ID = 'train-like-a-pro';

/**
 * The advertising banner on Programs while Train like a pro is not installed: a store-kit tile with the add-on's animated
 * icon (a still under reduced motion) and "Add", which opens the add-on's page in the store (owner decision 27.11, replaces
 * the quiet row of SPO-307). After installing, the quiet entry row takes its place. Every role that has Gym; nothing for a
 * role the store does not offer it to.
 */
export function CatalogPromoRow() {
  const installed = useEnabledAddons().has(ID);
  const { st } = useAddonStoreT();
  const m = addonById(ID);
  if (installed || !m || !isAddonAllowed(ID, getRole())) return null;
  const item = st.items[ID];
  const open = () => setHash(storeHash('item', ID));
  // The store's own surface: its colours follow the app's light / dark mode (like the set-options nudge).
  const root = typeof document === 'undefined' ? null : document.documentElement;
  const dark = root ? root.dataset.mode !== 'light' || root.dataset.sleep === 'night' : true;
  return (
    <section className={`sk-root ${dark ? 'sk-dark' : 'sk-light'} cpr`}>
      <SkBento>
        <SkBentoTile
          tone={m.tone}
          size="wide"
          span={2}
          eyebrow={item.tagline}
          aside={kindBadge(st, m)}
          title={item.name}
          titleSize="h2"
          onTitle={open}
          body={item.desc}
          footer={
            <span className="cpr-foot">
              <TileOf st={st} m={m} size={96} animated />
              <SkBtn kind="inv" onClick={open}>
                {st.add}
              </SkBtn>
            </span>
          }
        />
      </SkBento>
    </section>
  );
}
