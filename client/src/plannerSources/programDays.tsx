import { useMemo } from 'react';
import { useAddonOrBase } from '../addons/enabledSet';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { programDayName, useProgramMine } from '../data/programMine';
import { useT } from '../i18n';
import { registerPlannerSource, type PlannerSourceProps } from '../plannerSources';

function Group({ query, onPick }: PlannerSourceProps) {
  const { t } = useT();
  const gymOn = useAddonOrBase('gym');
  const { assignment, active } = useProgramMine();
  const days = useMemo(
    () =>
      gymOn && assignment && active
        ? [...new Set(assignment.program.items.map((i) => i.day))]
            .sort((a, b) => a - b)
            .map((day) => programDayName(assignment, day, t.progDay))
        : [],
    [gymOn, assignment, active, t],
  );
  const q = query.trim().toLowerCase();
  const shown = days.filter((n) => !q || n.toLowerCase().includes(q));
  if (!shown.length) return null;
  return (
    <GroupedList surface="raised" header={t.plannerSrcProgram}>
      {shown.map((name) => (
        <ListRow
          key={name}
          icon={<IconTile icon="list-checks" tone="accent" size={32} />}
          label={name}
          onClick={() => onPick({ title: name, icon: 'barbell', sub: t.plannerSrcProgram })}
        />
      ))}
    </GroupedList>
  );
}

registerPlannerSource({ id: 'program-days', order: 10, searchable: true, Group });
