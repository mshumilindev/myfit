/**
 * The athlete app as the SECOND host of the program editor tool (`tools/programEditor`, mode `self`): a person writes
 * their own program. This file is the whole host: the exercise catalog (data/exercises), the words (the shared
 * dictionaries, five locales) and `SelfProgramEditor`, the controlled editor for the app's own `Program`.
 *
 * `ProgramPage` (the Programs screen and the member's review of a trainer's program) is the only user of
 * `SelfProgramEditor`: there is no other program editor in the app.
 */
import { useMemo } from 'react';
import type { Shell } from '../../App';
import { getRole } from '../../api';
import { machineIcon } from '../../components/CardioMachineList';
import { CARDIO_PROFILES } from '../../cardio';
import { ClientTrainerDayTagLazy } from '../../coach/client/lazy';
import { exerciseFlag } from '../../conditions';
import { defaultWarmupValue, warmupUsesWeight } from '../../warmupLog';
import { exerciseUnit } from '../../store';
import { EQUIPMENT_CATALOG } from '../../data/equipmentCatalog';
import { localizedEquipName } from '../../data/equipmentI18n';
import { useConditionLimits } from '../../healthBuild';
import { equipmentLabel, MusclePickerMap } from '../../components/Muscle';
import { EQUIPMENT_IDS } from '../../data/equipment';
import {
  canonicalExerciseName,
  exerciseImage,
  muscleInfoByName,
  richExerciseByName,
  searchCatalog,
} from '../../data/exercises';
import { ACTIVITY_TYPES } from '../../activities';
import { useT, type LocaleId } from '../../i18n';
import { PG_LOCALES } from '../../i18n/coachProgram';
import {
  EditorPage,
  ProgramEditor,
  type ActivityKind,
  type ExerciseCatalog,
  type ExerciseFlag,
  type CardioKind,
  type EditorPageProps,
  type ProgramEditorHost,
  type ProgramEditorLabels,
  type ProgramEditorProps,
} from '../../tools/programEditor';
import { useWeekStartDay, weekOrder } from '../../weekStart';
import type { Program } from './model';
import { SelfExercisePicker } from './selfPicker';

/** The athlete's catalog. `flagOf` marks exercises that do not suit their health limits (never blocks). */
export const makeSelfCatalog = (
  flagOf: (name: string) => ExerciseFlag | null,
): ExerciseCatalog => ({
  facts(name) {
    const info = muscleInfoByName(name);
    const primary = info?.primary && info.primary !== 'cardio' ? info.primary : null;
    const secondary = (info?.secondary ?? []).filter((m) => m !== 'cardio' && m !== primary);
    const f = richExerciseByName(name)?.force;
    return {
      name,
      primary,
      secondary,
      muscles: primary ? [primary, ...secondary] : secondary,
      equipment: info?.equipment ?? null,
      image: exerciseImage(name, 'strength'),
      force: f === 'push' || f === 'pull' ? f : null,
      flag: flagOf(name),
    };
  },
  search(q) {
    const exclude = new Set((q.exclude ?? []).map((n) => n.toLowerCase()));
    return searchCatalog((q.query ?? '').trim(), (q.limit ?? 8) + exclude.size, undefined, q.muscle)
      .filter((h) => !exclude.has(h.names[0].toLowerCase()))
      .slice(0, q.limit ?? 8)
      .map((h) => ({
        id: h.id,
        name: h.names[0],
        muscle: h.muscle,
        equipment: h.equipment ?? null,
        image: exerciseImage(h.names[0], 'strength'),
        flag: flagOf(h.names[0]),
      }));
  },
});

export const selfCatalog: ExerciseCatalog = makeSelfCatalog(() => null);

const SELF_ACTIVITIES: ActivityKind[] = ACTIVITY_TYPES.map((a) => ({
  key: a.key,
  icon: a.icon,
  category: a.category,
}));

/** The few labels that name "the client" in the Coach dictionary; a person writing their own program is that person. */
const SELF_WORDS: Record<LocaleId, Pick<ProgramEditorLabels, 'edBareBody'>> = {
  en: {
    edBareBody: () =>
      'You pick sets, reps and weight in the session. Nothing is shown as a target for this exercise. It is valid to save as it is.',
  },
  uk: {
    edBareBody: () =>
      'Підходи, повторення і вагу ви обираєте під час тренування. Для цієї вправи ціль не показується. Зберегти можна й так.',
  },
  pl: {
    edBareBody: () =>
      'Serie, powtórzenia i ciężar wybierasz w trakcie treningu. Dla tego ćwiczenia nie pokazuje się celu. Można zapisać tak, jak jest.',
  },
  lt: {
    edBareBody: () =>
      'Serijas, pakartojimus ir svorį pasirenkate treniruotės metu. Šiam pratimui tikslas nerodomas. Galima išsaugoti ir taip.',
  },
  et: {
    edBareBody: () =>
      'Seeriad, kordused ja raskuse valid treeningu ajal. Selle harjutuse jaoks sihti ei näidata. Salvestada võib ka nii.',
  },
};

/** A trainer's "With your trainer" tag beside a day (client review only). */
function TrainerDayTag({ day }: { day: number }) {
  return <ClientTrainerDayTagLazy dow={day} />;
}

export interface SelfHostOptions {
  /** Opens exercise details / history. Without it the rows have no links. */
  shell?: Pick<Shell, 'openOverlay'>;
  /** A program someone else wrote (the member's view of their trainer's program). */
  readOnly?: boolean;
  /** The planned-activities list is sealed and this device cannot open it: the tool must not touch it. */
  activitiesLocked?: boolean;
}

export function useSelfEditorHost(o: SelfHostOptions = {}): ProgramEditorHost {
  const { t, locale } = useT();
  const start = useWeekStartDay();
  const limits = useConditionLimits();
  const { shell, readOnly, activitiesLocked } = o;
  return useMemo(() => {
    // Only for the person training it: a coach building a client's plan has their own limits.
    const flagOf = (name: string): ExerciseFlag | null => {
      if (!limits.keys.length || getRole() !== 'member') return null;
      const level = exerciseFlag(name, limits).level;
      return level === 'avoid'
        ? { level: 'avoid', label: t.pickNotAdvised }
        : level === 'caution'
          ? { level: 'caution', label: t.pickCareful }
          : null;
    };
    const cardio: CardioKind[] = EQUIPMENT_CATALOG.filter(
      (e) => e.category === 'cardio' && e.id in CARDIO_PROFILES,
    ).map((e) => ({ name: localizedEquipName(e, locale), icon: machineIcon(e.id) }));
    return {
      mode: 'self',
      catalog: makeSelfCatalog(flagOf),
      labels: { ...PG_LOCALES[locale], ...SELF_WORDS[locale] },
      words: {
        muscleGroups: t.muscleGroups,
        actType: t.actType,
        actEffortLevel: t.actEffortLevel,
        equipmentLabel,
      },
      activities: SELF_ACTIVITIES,
      equipment: EQUIPMENT_IDS,
      weekOrder: weekOrder(start),
      newRows: 'targets',
      warmupTarget: defaultWarmupValue,
      canonicalName: canonicalExerciseName,
      warmupWeighted: warmupUsesWeight,
      weightUnit: exerciseUnit,
      cardio,
      features: { activities: !activitiesLocked },
      exerciseLinks: shell
        ? (name) => [
            {
              label: t.pgDetailsOf(name),
              icon: 'info',
              onClick: () => shell.openOverlay({ screen: 'exercise-detail', name }),
            },
            {
              label: t.openHistory,
              icon: 'clock-counter-clockwise',
              onClick: () => shell.openOverlay({ screen: 'exercise-history', name }),
            },
          ]
        : undefined,
      slots: {
        muscleMap: MusclePickerMap,
        ...(readOnly ? { dayTag: TrainerDayTag } : { exercisePicker: SelfExercisePicker }),
      },
    };
  }, [t, locale, start, limits, shell, readOnly, activitiesLocked]);
}

export interface SelfProgramEditorProps extends Omit<
  ProgramEditorProps,
  'doc' | 'onChange' | 'host' | 'audience' | 'partner'
> {
  program: Program;
  onChange: (next: Program) => void;
  host?: SelfHostOptions;
}

/** The tool, controlled by the app's own `Program`. The tool spreads what it is given, so host-only fields survive. */
export function SelfProgramEditor({
  program,
  onChange,
  host: hostOptions,
  ...rest
}: SelfProgramEditorProps) {
  const host = useSelfEditorHost({ readOnly: rest.readOnly, ...hostOptions });
  return (
    <ProgramEditor
      {...rest}
      host={host}
      doc={program}
      onChange={(next) => onChange(next as unknown as Program)}
    />
  );
}

export interface SelfProgramPageProps extends Omit<
  EditorPageProps,
  'doc' | 'onChange' | 'host' | 'audience' | 'partner'
> {
  program: Program;
  onChange: (next: Program) => void;
  host?: SelfHostOptions;
}

/** The athlete's program editor PAGE: the tool's page layout with the athlete's host and the app's own `Program`. */
export function SelfProgramPage({
  program,
  onChange,
  host: hostOptions,
  ...rest
}: SelfProgramPageProps) {
  const host = useSelfEditorHost({ readOnly: rest.readOnly, ...hostOptions });
  return (
    <EditorPage
      {...rest}
      host={host}
      doc={program}
      onChange={(next) => onChange(next as unknown as Program)}
    />
  );
}
