import { ACTIVITY_TYPES } from '../activities';
import { useActivitiesOn } from '../addons/activitiesGate';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { t as tr, useT } from '../i18n';
import {
  registerPlannerSource,
  type PlannerAllProps,
  type PlannerPick,
  type PlannerSourceProps,
} from '../plannerSources';
import { Icon } from '../ui';
import { kitTone, typeName } from '../views/logActivity/shared';

const SHOWN = 3;

function Row(p: {
  k: string;
  icon: string;
  selectedId: string | null;
  onPick: (x: PlannerPick) => void;
}) {
  const { t } = useT();
  const name = typeName(p.k, t);
  return (
    <ListRow
      icon={<IconTile icon={p.icon} tone={kitTone(p.k)} size={32} />}
      label={name}
      sub={t.plannerSrcActivity}
      trailing={p.selectedId === `activity:${p.k}` ? <Icon name="check" /> : undefined}
      onClick={() =>
        p.onPick({ id: `activity:${p.k}`, title: name, icon: p.icon, sub: t.plannerSrcActivities })
      }
    />
  );
}

function Group({ selectedId, onPick, onAll }: PlannerSourceProps) {
  const { t } = useT();
  if (!useActivitiesOn()) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcActivities}>
      {ACTIVITY_TYPES.slice(0, SHOWN).map((a) => (
        <Row key={a.key} k={a.key} icon={a.icon} selectedId={selectedId} onPick={onPick} />
      ))}
      <ListRow label={t.plannerSrcAllActivities} chevron onClick={onAll} />
    </GroupedList>
  );
}

function All({ query, selectedId, onPick }: PlannerAllProps) {
  const { t } = useT();
  const on = useActivitiesOn();
  const q = query.trim().toLowerCase();
  const shown = on
    ? ACTIVITY_TYPES.filter((a) => !q || typeName(a.key, t).toLowerCase().includes(q))
    : [];
  if (!shown.length) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcActivities}>
      {shown.map((a) => (
        <Row key={a.key} k={a.key} icon={a.icon} selectedId={selectedId} onPick={onPick} />
      ))}
    </GroupedList>
  );
}

registerPlannerSource({
  id: 'activities',
  order: 30,
  Group,
  All,
  allTitle: () => tr().plannerSrcActivities,
  searchPlaceholder: () => tr().plannerSrcActivities,
});
