import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { Chip } from '../components/ui/Chip';
import { useState } from 'react';
import type { Role } from '../api';
import { useEnabledAddons } from '../addons/enabledSet';
import { useAddonStoreT } from '../i18n/addonStore';
import type { AddonStoreStrings } from '../i18n/addonStore';
import { catalogForRole, STORE_CATEGORIES, type StoreCategory } from './storeCatalog';
import { ItemRow } from './StoreParts';

const CAT_ICON: Record<StoreCategory, string> = {
  recovery: 'heartbeat',
  food: 'fork-knife',
  insights: 'chart-line-up',
  look: 'palette',
  coach: 'chalkboard-teacher',
};

function catLabel(st: AddonStoreStrings, c: StoreCategory): string {
  const map: Record<StoreCategory, string> = {
    recovery: st.catRecovery,
    food: st.catFood,
    insights: st.catInsights,
    look: st.catLook,
    coach: st.catCoach,
  };
  return map[c];
}

export function StoreBrowse({ role }: { role: Role }) {
  const { st } = useAddonStoreT();
  const enabled = useEnabledAddons();
  const [cat, setCat] = useState<StoreCategory | null>(null);
  const items = catalogForRole(role);
  const cats = STORE_CATEGORIES.filter((c) => items.some((m) => m.category === c));

  if (cat) {
    const list = items.filter((m) => m.category === cat);
    return (
      <div className="as-stack">
        <div className="as-chips">
          <Chip size="sm" onClick={() => setCat(null)} icon="caret-left">
            {st.catAll}
          </Chip>
          {cats.map((c) => (
            <Chip key={c} size="sm" selected={c === cat} onClick={() => setCat(c)}>
              {catLabel(st, c)}
            </Chip>
          ))}
        </div>
        <GroupedList header={catLabel(st, cat)} label={catLabel(st, cat)}>
          {list.map((m) => (
            <ItemRow
              key={m.id}
              m={m}
              st={st}
              value={m.soon ? st.soon : enabled.has(m.id) ? st.installedStatus : undefined}
            />
          ))}
        </GroupedList>
      </div>
    );
  }

  return (
    <GroupedList label={st.tabBrowse}>
      {cats.map((c) => {
        const list = items.filter((m) => m.category === c);
        const allSoon = list.every((m) => m.soon);
        return (
          <ListRow
            key={c}
            icon={<IconTile tone="neutral" icon={CAT_ICON[c]} size={36} />}
            label={catLabel(st, c)}
            value={allSoon ? st.soon : list.length}
            chevron
            onClick={() => setCat(c)}
          />
        );
      })}
    </GroupedList>
  );
}
