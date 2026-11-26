import { Card } from '../../components/ui/Card';
import { ListRow } from '../../components/ui/GroupedList';
import { getRole } from '../../api';
import { isAddonAllowed, useEnabledAddons } from '../../addons/enabledSet';
import { useAddonStoreT } from '../../i18n/addonStore';
import { storeHash } from '../../addonStore/storeRoute';
import { setHash } from '../../route';

const ID = 'train-like-a-pro';

/**
 * The quiet row on Programs while Train like a pro is not installed: the same row as after installing, with "Add" on the
 * right, which opens the add-on's page in the store (owner decision SPO-307; no banner). Every role that has Gym; nothing for a role
 * the store does not offer it to.
 */
export function CatalogPromoRow() {
  const installed = useEnabledAddons().has(ID);
  const { st } = useAddonStoreT();
  if (installed || !isAddonAllowed(ID, getRole())) return null;
  const item = st.items[ID];
  return (
    <section>
      <Card pad="none" emphasis="card">
        <ListRow
          strong
          label={item.name}
          sub={item.tagline}
          value={st.add}
          onClick={() => setHash(storeHash('item', ID))}
        />
      </Card>
    </section>
  );
}
