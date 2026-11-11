import { useMemo } from 'react';
import { useAddonOrBase } from '../addons/enabledSet';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { programDayItems, programDayName, useProgramMine } from '../data/programMine';
import { useT } from '../i18n';
import { registerPlannerSource, type PlannerSourceProps } from '../plannerSources';
import { Icon } from '../ui';

/** Day 1 = Monday (2026-11-09 is a Monday). */
const weekdayShort = (locale: string, day: number) =>
  new Date(2026, 10, 8 + day).toLocaleDateString(locale, { weekday: 'short' });

function Group({ selectedId, onPick }: PlannerSourceProps) {
  const { t, locale } = useT();
  const gymOn = useAddonOrBase('gym');
  const { assignment, active } = useProgramMine();
  const days = useMemo(
    () =>
      gymOn && assignment && active
        ? [...new Set(assignment.program.items.map((i) => i.day))]
            .sort((a, b) => a - b)
            .map((day) => ({
              day,
              name: programDayName(assignment, day, t.progDay),
              n: programDayItems(assignment, day).length,
            }))
        : [],
    [gymOn, assignment, active, t],
  );
  if (!gymOn) return null;
  if (!assignment || !days.length)
    return (
      <GroupedList surface="raised" header={t.plannerSrcProgram}>
        <ListRow
          icon={<IconTile icon="barbell" tone="active" size={32} />}
          label={t.plannerSrcWorkout}
          trailing={selectedId === 'workout:any' ? <Icon name="check" /> : undefined}
          onClick={() =>
            onPick({
              id: 'workout:any',
              title: t.plannerSrcWorkout,
              icon: 'barbell',
              sub: t.plannerSrcProgram,
            })
          }
        />
      </GroupedList>
    );
  return (
    <GroupedList surface="raised" header={`${t.plannerSrcProgram} · ${assignment.program.name}`}>
      {days.map((d) => (
        <ListRow
          key={d.day}
          icon={<IconTile icon="barbell" tone="active" size={32} />}
          label={d.name}
          sub={`${weekdayShort(locale, d.day)} · ${t.nExercises(d.n)}`}
          trailing={selectedId === `program:${d.day}` ? <Icon name="check" /> : undefined}
          onClick={() =>
            onPick({
              id: `program:${d.day}`,
              title: d.name,
              icon: 'barbell',
              sub: t.plannerSrcProgram,
            })
          }
        />
      ))}
    </GroupedList>
  );
}

registerPlannerSource({ id: 'program-days', order: 10, Group });
