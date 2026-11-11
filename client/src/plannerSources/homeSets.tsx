import { useAddonOrBase } from '../addons/enabledSet';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { t as tr, useT } from '../i18n';
import {
  registerPlannerSource,
  type PlannerAllProps,
  type PlannerPick,
  type PlannerSourceProps,
} from '../plannerSources';
import { useStore } from '../store';
import { Icon } from '../ui';

const SHOWN = 3;

function useOn() {
  return useAddonOrBase('home-sets');
}
function useSets() {
  const sets = useStore().home.sets;
  return useOn() ? sets : [];
}

function Row(p: {
  id: string;
  name: string;
  selectedId: string | null;
  onPick: (x: PlannerPick) => void;
}) {
  const { t } = useT();
  return (
    <ListRow
      icon={<IconTile icon="house" tone="home" size={32} />}
      label={p.name}
      sub={t.plannerSrcHomeSet}
      trailing={p.selectedId === `home:${p.id}` ? <Icon name="check" /> : undefined}
      onClick={() =>
        p.onPick({ id: `home:${p.id}`, title: p.name, icon: 'house', sub: t.plannerSrcHome })
      }
    />
  );
}

function Group({ selectedId, onPick, onAll }: PlannerSourceProps) {
  const { t } = useT();
  const sets = useSets();
  if (!useOn()) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcHome}>
      <ListRow
        icon={<IconTile icon="house" tone="home" size={32} />}
        label={t.plannerSrcHomeAny}
        sub={t.plannerSrcHomeSet}
        trailing={selectedId === 'home:any' ? <Icon name="check" /> : undefined}
        onClick={() =>
          onPick({
            id: 'home:any',
            title: t.plannerSrcHomeAny,
            icon: 'house',
            sub: t.plannerSrcHome,
          })
        }
      />
      {sets.slice(0, SHOWN).map((h) => (
        <Row key={h.id} id={h.id} name={h.name} selectedId={selectedId} onPick={onPick} />
      ))}
      {sets.length > SHOWN && <ListRow label={t.plannerSrcAllHome} chevron onClick={onAll} />}
    </GroupedList>
  );
}

function All({ query, selectedId, onPick }: PlannerAllProps) {
  const { t } = useT();
  const q = query.trim().toLowerCase();
  const sets = useSets().filter((h) => !q || h.name.toLowerCase().includes(q));
  if (!sets.length) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcHome}>
      {sets.map((h) => (
        <Row key={h.id} id={h.id} name={h.name} selectedId={selectedId} onPick={onPick} />
      ))}
    </GroupedList>
  );
}

registerPlannerSource({
  id: 'home-sets',
  order: 20,
  Group,
  All,
  allTitle: () => tr().plannerSrcHome,
  searchPlaceholder: () => tr().plannerSrcHome,
});
