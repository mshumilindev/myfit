import { getRole } from '../../api';
import { isAddonAllowed, useEnabledAddons } from '../../addons/enabledSet';
import { addonById } from '../../addons/manifest';
import { useAddonStoreT } from '../../i18n/addonStore';
import { storeHash } from '../../addonStore/storeRoute';
import { StoreSurface } from '../../addonStore/StoreSurface';
import { TileOf, kindBadge } from '../../addonStore/storeItems';
import { SkBtn, SkCard, SkRow } from '../../store-kit';
import { setHash } from '../../route';

const ID = 'train-like-a-pro';

/**
 * The compact store banner on Programs while Train like a pro is not installed: a store-kit card row (like the set-options nudge) with the add-on's animated
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
  return (
    <StoreSurface>
      <SkCard pad>
        <SkRow
          noBorder
          tile={<TileOf st={st} m={m} size={64} animated />}
          name={item.name}
          desc={item.tagline}
          badge={kindBadge(st, m)}
          action={
            <SkBtn kind="tint" size="s" onClick={open}>
              {st.add}
            </SkBtn>
          }
          onOpen={open}
        />
      </SkCard>
    </StoreSurface>
  );
}
