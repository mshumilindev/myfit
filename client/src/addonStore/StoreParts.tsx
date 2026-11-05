import { Chip } from '../components/ui/Chip';
import { IconTile } from '../components/ui/IconTile';
import { ListRow } from '../components/ui/GroupedList';
import type { ReactNode } from 'react';
import type { AddonManifest } from '../addons/manifest';
import type { AddonStoreStrings } from '../i18n/addonStore';
import { STORE_ICON, STORE_TONE, type ItemId } from './storeMeta';

export function itemText(st: AddonStoreStrings, id: string): { name: string; desc: string } {
  return st.items[id as ItemId];
}

/** "Uses Health" for an add-on, nothing for an app. */
export function parentHint(st: AddonStoreStrings, m: AddonManifest): string | null {
  return m.parent ? st.usesParent(itemText(st, m.parent).name) : null;
}

export function KindChip({ m, st }: { m: AddonManifest; st: AddonStoreStrings }) {
  return (
    <Chip size="xs" muted>
      {m.kind === 'app' ? st.kindApp : st.kindAddon}
    </Chip>
  );
}

export function ItemTile({ m, size = 36 }: { m: AddonManifest; size?: 36 | 48 | 56 }) {
  return <IconTile tone={STORE_TONE[m.tone]} icon={STORE_ICON[m.id as ItemId]} size={size} />;
}

/** One catalog row: tile in the item's colour, name, description (+ parent hint), App / Add-on chip. */
export function ItemRow({
  m,
  st,
  value,
}: {
  m: AddonManifest;
  st: AddonStoreStrings;
  value?: ReactNode;
}) {
  const { name, desc } = itemText(st, m.id);
  const hint = parentHint(st, m);
  return (
    <ListRow
      icon={<ItemTile m={m} />}
      label={name}
      sub={hint ? `${desc} · ${hint}` : desc}
      value={value}
      trailing={<KindChip m={m} st={st} />}
    />
  );
}
