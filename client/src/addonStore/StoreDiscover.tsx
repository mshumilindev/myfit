import { Card } from '../components/ui/Card';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { SearchField } from '../components/ui/SearchField';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useState } from 'react';
import type { Role } from '../api';
import { addonById, type AddonManifest } from '../addons/manifest';
import { allowedIds, useEnabledAddons } from '../addons/enabledSet';
import { useAddonStoreT } from '../i18n/addonStore';
import { tokenMatch } from '../search';
import { availableForRole, catalogForRole, comingSoonForRole } from './storeCatalog';
import { ItemRow, ItemTile, itemText, KindChip } from './StoreParts';

/** The pick shown as "App of the week" until the store has an editorial source. */
export const APP_OF_THE_WEEK = 'sleep';

export function StoreDiscover({ role }: { role: Role }) {
  const { st } = useAddonStoreT();
  const enabled = useEnabledAddons();
  const [query, setQuery] = useState('');

  const total = allowedIds(role).length;
  const on = allowedIds(role).filter((id) => enabled.has(id)).length;
  const notOn = availableForRole(role).filter((m) => !enabled.has(m.id));
  const soon = comingSoonForRole(role);
  const pick = addonById(APP_OF_THE_WEEK);
  const showPick = !!pick && availableForRole(role).some((m) => m.id === pick.id);

  const search = query.trim();
  const found: AddonManifest[] = search
    ? catalogForRole(role).filter((m) => {
        const t = itemText(st, m.id);
        return tokenMatch(`${t.name} ${t.desc}`, search);
      })
    : [];

  return (
    <div className="as-stack">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={st.search}
        clearLabel={st.searchClear}
      />
      {search ? (
        found.length ? (
          <GroupedList label={st.search}>
            {found.map((m) => (
              <ItemRow key={m.id} m={m} st={st} value={m.soon ? st.soon : undefined} />
            ))}
          </GroupedList>
        ) : (
          <Card emphasis="quiet">{st.noResults}</Card>
        )
      ) : (
        <>
          {showPick && pick && (
            <section className="as-stack" aria-label={st.weekTitle}>
              <SectionLabel>{st.weekTitle}</SectionLabel>
              <Card emphasis="hero">
                <ListRow
                  icon={<ItemTile m={pick} size={56} />}
                  label={itemText(st, pick.id).name}
                  sub={itemText(st, pick.id).desc}
                  trailing={<KindChip m={pick} st={st} />}
                />
              </Card>
            </section>
          )}
          <Card emphasis="card" header={st.yourSpotter}>
            <p className="as-progress">{st.progress(on, total)}</p>
          </Card>
          <GroupedList header={st.notTurnedOn} label={st.notTurnedOn}>
            {notOn.length ? (
              notOn.map((m) => <ItemRow key={m.id} m={m} st={st} />)
            ) : (
              <ListRow label={st.allTurnedOn} />
            )}
          </GroupedList>
          {soon.length > 0 && (
            <Card emphasis="quiet" header={st.comingSoon}>
              <GroupedList label={st.comingSoon} surface="flat">
                {soon.map((m) => (
                  <ItemRow key={m.id} m={m} st={st} value={st.soon} />
                ))}
              </GroupedList>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
