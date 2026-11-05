import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { Switch } from '../components/ui/Switch';
import type { Role } from '../api';
import { ADDONS, type AddonManifest } from '../addons/manifest';
import {
  disableAddons,
  enableAddons,
  isAddonAllowed,
  useEnabledAddons,
} from '../addons/enabledSet';
import { useAddonStoreT } from '../i18n/addonStore';
import { ItemTile, itemText, KindChip, parentHint } from './StoreParts';

/** Top-level enabled items (apps, and add-ons with no parent such as Gyms) with the add-ons of each. */
export function installedGroups(
  enabled: ReadonlySet<string>,
  role: Role,
): { head: AddonManifest; addons: AddonManifest[] }[] {
  return ADDONS.filter((m) => !m.parent && enabled.has(m.id)).map((head) => ({
    head,
    addons: ADDONS.filter((a) => a.parent === head.id && isAddonAllowed(a.id, role)),
  }));
}

export function StoreInstalled({ role }: { role: Role }) {
  const { st } = useAddonStoreT();
  const enabled = useEnabledAddons();
  const groups = installedGroups(enabled, role);

  if (!groups.length)
    return (
      <Card emphasis="quiet">
        <EmptyState
          icon="plugs"
          title={st.installedEmptyTitle}
          body={st.installedEmptyBody}
          titleAs="h3"
        />
      </Card>
    );

  const toggle = (id: string, on: boolean) =>
    on ? enableAddons([id], role) : disableAddons([id], role);

  const row = (m: AddonManifest) => {
    const name = itemText(st, m.id).name;
    const hint = parentHint(st, m);
    return (
      <ListRow
        key={m.id}
        as="label"
        icon={<ItemTile m={m} />}
        label={name}
        sub={hint ?? itemText(st, m.id).desc}
        trailing={
          <>
            <KindChip m={m} st={st} />
            <Switch
              checked={enabled.has(m.id)}
              onChange={(on) => toggle(m.id, on)}
              aria-label={st.turnOn(name)}
            />
          </>
        }
      />
    );
  };

  return (
    <div className="as-stack">
      {groups.map(({ head, addons }) => (
        <GroupedList key={head.id} label={itemText(st, head.id).name}>
          {row(head)}
          {addons.map(row)}
        </GroupedList>
      ))}
    </div>
  );
}
