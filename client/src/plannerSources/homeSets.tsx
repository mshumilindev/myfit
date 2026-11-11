import { useAddonOrBase } from '../addons/enabledSet';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { useT } from '../i18n';
import { registerPlannerSource, type PlannerSourceProps } from '../plannerSources';
import { useStore } from '../store';

function Group({ query, onPick }: PlannerSourceProps) {
  const { t } = useT();
  const on = useAddonOrBase('home-sets');
  const sets = useStore().home.sets;
  const q = query.trim().toLowerCase();
  const shown = on ? sets.filter((h) => !q || h.name.toLowerCase().includes(q)) : [];
  if (!shown.length) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcHome}>
      {shown.map((h) => (
        <ListRow
          key={h.id}
          icon={<IconTile icon="house" tone="home" size={32} />}
          label={h.name}
          onClick={() => onPick({ title: h.name, icon: 'house', sub: t.plannerSrcHome })}
        />
      ))}
    </GroupedList>
  );
}

registerPlannerSource({ id: 'home-sets', order: 20, searchable: true, Group });
