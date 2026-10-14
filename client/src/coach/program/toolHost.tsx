/**
 * The Coach side of the program editor tool (`tools/programEditor`): the labels from the Coach dictionary and the
 * anatomy figure, handed to the tool as one `ProgramEditorHost`. The screens (editor, check) are thin hosts of it.
 */
import { useMemo } from 'react';
import { equipmentLabel, MusclePickerMap } from '../../components/Muscle';
import { EQUIPMENT_IDS } from '../../data/equipment';
import { canonicalExerciseName } from '../../data/exercises';
import { warmupUsesWeight } from '../../warmupLog';
import { useT } from '../../i18n';
import { usePgT } from '../../i18n/coachProgram';
import type { LibraryDay, ProgramEditorHost } from '../../tools/programEditor';
import { weekOrder, useWeekStartDay } from '../../weekStart';
import { COACH_ACTIVITIES, coachCatalog } from './toolHostBase';

export interface CoachEditorHostOptions {
  library?: readonly LibraryDay[];
  restrictions?: readonly string[];
}

/** The host for the Coach screens: labels from the Coach dictionary, words from the main one, five locales. */
export function useCoachEditorHost({
  library,
  restrictions = [],
}: CoachEditorHostOptions = {}): ProgramEditorHost {
  const { p } = usePgT();
  const { t } = useT();
  const restrictionKey = restrictions.join('|');
  const start = useWeekStartDay();
  const order = useMemo(() => weekOrder(start), [start]);
  return useMemo(
    () => ({
      mode: 'coach',
      catalog: coachCatalog,
      labels: p,
      words: {
        muscleGroups: t.muscleGroups,
        actType: t.actType,
        actEffortLevel: t.actEffortLevel,
        equipmentLabel,
      },
      activities: COACH_ACTIVITIES,
      equipment: EQUIPMENT_IDS,
      weekOrder: order,
      canonicalName: canonicalExerciseName,
      warmupWeighted: warmupUsesWeight,
      library,
      checkContext: { restrictions: restrictionKey ? restrictionKey.split('|') : [] },
      slots: { muscleMap: MusclePickerMap },
    }),
    [p, t, library, restrictionKey, order],
  );
}
