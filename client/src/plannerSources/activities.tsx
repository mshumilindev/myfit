import { useActivitiesOn } from '../addons/activitiesGate';
import { ACTIVITY_TYPES } from '../activities';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { useT } from '../i18n';
import { registerPlannerSource, type PlannerSourceProps } from '../plannerSources';
import { kitTone, typeName } from '../views/logActivity/shared';

function Group({ query, onPick }: PlannerSourceProps) {
  const { t } = useT();
  const on = useActivitiesOn();
  const q = query.trim().toLowerCase();
  const shown = on
    ? ACTIVITY_TYPES.map((a) => ({ key: a.key, icon: a.icon, name: typeName(a.key, t) })).filter(
        (a) => !q || a.name.toLowerCase().includes(q),
      )
    : [];
  if (!shown.length) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcActivities}>
      {shown.map((a) => (
        <ListRow
          key={a.key}
          icon={<IconTile icon={a.icon} tone={kitTone(a.key)} size={32} />}
          label={a.name}
          onClick={() => onPick({ title: a.name, icon: a.icon, sub: t.plannerSrcActivities })}
        />
      ))}
    </GroupedList>
  );
}

registerPlannerSource({ id: 'activities', order: 30, searchable: true, Group });
