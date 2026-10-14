import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Chip, ChipGroup } from '../../../components/ui/Chip';
import { Field } from '../../../components/ui/Field';
import { ExerciseRow } from '../../../components/ui/ExerciseRow';
import { ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Segmented } from '../../../components/ui/Segmented';
import type { EditorFeatures, ProgramEditorHost } from '../host';
import type { ProgramEditorLabels, ProgramEditorWords } from '../labels';
import {
  dayActivities,
  dayItems,
  dayName,
  dowOf,
  isBare,
  programSets,
  supersetLabels,
  type DayMode,
  type MuscleGroup,
  type ProgramActivityDoc,
  type ProgramDoc,
  type ProgramItemDoc,
} from '../model/doc';
import { derivedMuscles } from '../model/ops';
import { MuscleMap } from './MuscleMap';
import { firstName, prescriptionLine, repsText, targetText } from './text';

/** Muscle tiles grouped like the real builder's exercise picker families. */
export const MUSCLE_BLOCKS: { id: string; muscles: MuscleGroup[] }[] = [
  { id: 'chest', muscles: ['chest'] },
  { id: 'back', muscles: ['back', 'lats', 'traps', 'lower_back'] },
  { id: 'shoulders', muscles: ['shoulders', 'neck'] },
  { id: 'arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'] },
  { id: 'core', muscles: ['core'] },
  { id: 'fullbody', muscles: ['fullbody'] },
];

export interface DayCardProps {
  p: ProgramEditorLabels;
  t: ProgramEditorWords;
  host: ProgramEditorHost;
  features: EditorFeatures;
  readOnly: boolean;
  draft: ProgramDoc;
  day: number;
  /** The mode the UI shows (a muscles day stays "muscles" until an exercise is added; a trainer may also open an empty day as exercises). */
  mode: DayMode;
  partnerDays: readonly number[];
  partner: string;
  selectedId: string;
  paneIsEdit: boolean;
  /** Phone: the muscle map sits inside the day, on desktop it lives in the inspector. */
  mapInline: boolean;
  onMode: (m: DayMode) => void;
  onSelect: (id: string, kind: 'row' | 'act') => void;
  onToggleMuscle: (m: MuscleGroup) => void;
  onBareToTargets: (id: string) => void;
  onAddExercise: () => void;
  onAddActivity: () => void;
  onPreview: () => void;
  onCopyDay: () => void;
  onLibrary: () => void;
  /** Edit the day's name (feature `dayNames`); absent = the name is read only. */
  onRename?: (name: string) => void;
  audience: string;
}

export function DayCard(c: DayCardProps) {
  const { p, t, draft: d, day } = c;
  const blockLabel = (id: string): string =>
    id === 'arms' ? p.edArms : id === 'legs' ? p.edLegs : (t.muscleGroups[id] ?? id);
  const dow = dowOf(day);
  const items = dayItems(d, day);
  const lifts = items.filter((i) => i.kind === 'strength');
  const acts = dayActivities(d, day);
  const labels = supersetLabels(items);
  const trainer = firstName(c.partner);
  const chosen = d.targetMuscles[String(day)] ?? [];
  const derived = derivedMuscles(items, c.host.catalog);
  const bare = lifts.filter((i) => isBare(i)).length;
  const actMin = acts.reduce((n, a) => n + a.minutes, 0);
  const title = dayName(d, day) || p.dowFull[dow];

  const actRow = (a: ProgramActivityDoc) => {
    const type = c.host.activities.find((x) => x.key === a.type);
    const on = c.selectedId === a.id;
    return (
      <li key={a.id}>
        <ListRow
          dense
          strong
          selected={on}
          aria-pressed={on}
          icon={<IconTile icon={type?.icon ?? 'heartbeat'} tone="conditioning" size={40} />}
          label={t.actType[a.type] ?? a.type}
          sub={`${p.ckMin(a.minutes)} · ${t.actEffortLevel[a.effort] ?? a.effort} · ${p.edWhenText[a.when]}`}
          trailing={<span className="pe-xt">{p.edEffortOnly}</span>}
          chevron
          onClick={() => c.onSelect(a.id, 'act')}
        />
      </li>
    );
  };

  const exRow = (it: ProgramItemDoc) => {
    if (it.kind === 'cardio') {
      return (
        <li key={it.id}>
          <ListRow
            dense
            strong
            selected={c.selectedId === it.id}
            aria-pressed={c.selectedId === it.id}
            icon={<IconTile icon="heartbeat" tone="conditioning" size={40} />}
            label={it.name}
            sub={p.ckMin(it.durationMin ?? 0)}
            chevron
            onClick={() => c.onSelect(it.id, 'row')}
          />
        </li>
      );
    }
    if (it.kind !== 'strength') {
      const warm = it.kind === 'warmup';
      return (
        <li key={it.id}>
          <ListRow
            dense
            strong
            selected={c.selectedId === it.id}
            aria-pressed={c.selectedId === it.id}
            icon={<IconTile icon={warm ? 'flame' : 'snowflake'} size={40} />}
            label={it.name}
            sub={
              warm && it.warmupItems?.length
                ? it.warmupItems.map((w) => w.name).join(' · ')
                : p.edMarkerNote
            }
            chevron
            onClick={() => c.onSelect(it.id, 'row')}
          />
        </li>
      );
    }
    const f = c.host.catalog.facts(it.name);
    const isB = isBare(it);
    const sel = c.selectedId === it.id;
    const tgt = targetText(it, p);
    const sub = [
      f.muscles
        .slice(0, 2)
        .map((m) => t.muscleGroups[m] ?? m)
        .join(' · '),
      f.flag?.label ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <li key={it.id} className={isB ? 'pe-xrow' : undefined}>
        <ExerciseRow
          name={it.name}
          image={f.image}
          badge={labels.get(it.id)}
          sub={sub}
          prescription={c.mapInline ? prescriptionLine(it, p) : undefined}
          selected={sel}
          aria-pressed={sel}
          aria-label={p.edRowAria(it.name, isB ? p.edNoSetsYet : prescriptionLine(it, p))}
          chevron
          onClick={() => c.onSelect(it.id, 'row')}
          trailing={
            !isB && !c.mapInline ? (
              <span className="pe-xcols">
                <span className="pe-xs num">{repsText(it)}</span>
                <span className="pe-xt">{tgt || p.edNoTarget}</span>
              </span>
            ) : undefined
          }
        />
        {isB && !c.readOnly && (
          <Chip
            size="xs"
            className="pe-addsets"
            aria-label={`${p.edAddSets}: ${it.name}`}
            onClick={() => c.onBareToTargets(it.id)}
          >
            {p.edAddSets}
          </Chip>
        )}
      </li>
    );
  };

  const summary =
    c.mode === 'muscles'
      ? p.edMusclesChosen(chosen.length)
      : `${p.edDayCardSummary(lifts.length, programSets(d, day))}${bare ? ` · ${p.edWithoutSets(bare)}` : ''}`;

  return (
    <Card pad="none" className="pe-dc" aria-label={title}>
      <div className="pe-dc-h">
        <span className="pe-dc-t">
          <small>{p.dowFull[dow]}</small>
          {c.onRename ? (
            <Field
              className="pe-dc-name"
              value={d.dayNames[String(day)] ?? ''}
              placeholder={p.edNameDay}
              maxLength={40}
              aria-label={p.edDayNameAria(p.dowFull[dow])}
              onChange={(e) => c.onRename?.(e.target.value)}
            />
          ) : (
            <h2>{title}</h2>
          )}
        </span>
        {!c.partner ? null : c.partnerDays.includes(c.day) ? (
          <Chip className="pe-dc-tag" tone="accent" icon="user-focus">
            {p.edWithTrainer(trainer)}
          </Chip>
        ) : (
          <Chip className="pe-dc-tag">{p.edSoloDay}</Chip>
        )}
        <span className="pe-dc-s">
          {summary}
          {actMin > 0 ? ` · ${p.edActivityMin(actMin)}` : ''}
        </span>
      </div>

      <div className="pe-dc-m">
        {c.features.muscleDays && (
          <Segmented
            fill
            label={p.edDayMode}
            value={c.mode}
            onChange={c.readOnly ? () => undefined : c.onMode}
            options={[
              { value: 'muscles', label: p.edMuscles, icon: 'person-simple' },
              { value: 'exercises', label: p.edExercises, icon: 'barbell' },
            ]}
          />
        )}
        {c.mode === 'exercises' && derived.length > 0 && (
          <div className="pe-derived">
            <span className="pe-derived-l">
              <IconTile icon="lock-simple" size={22} outline />
              {p.edFromExercises}
            </span>
            <ChipGroup>
              {derived.slice(0, 6).map((m) => (
                <Chip key={m} size="xs" tone="accent">
                  {t.muscleGroups[m] ?? m}
                </Chip>
              ))}
            </ChipGroup>
          </div>
        )}
      </div>

      {c.mode === 'muscles' ? (
        <div className="pe-mbody">
          {c.mapInline && (
            <MuscleMap
              host={c.host}
              selected={chosen}
              onToggle={c.readOnly ? undefined : c.onToggleMuscle}
              labels={{ front: p.edMapFront, back: p.edMapBack }}
              className="pe-map"
            />
          )}
          <div className="pe-mchosen" aria-live="polite">
            <SectionLabel>{p.edTargetMuscles}</SectionLabel>
            {chosen.length ? (
              <ChipGroup>
                {chosen
                  .filter((m) => m !== 'fullbody' || chosen.length === 1)
                  .map((m) => (
                    <Chip
                      key={m}
                      size="xs"
                      tone="accent"
                      icon="check"
                      aria-label={t.muscleGroups[m] ?? m}
                    >
                      {t.muscleGroups[m] ?? m}
                    </Chip>
                  ))}
              </ChipGroup>
            ) : (
              <span className="pe-hint">{p.edPickMuscle}</span>
            )}
          </div>
          <div className="pe-mgroups" role="group" aria-label={p.edMuscleGroups}>
            {MUSCLE_BLOCKS.map((b) => (
              <div key={b.id} className="pe-mgroup">
                {b.muscles.length > 1 && <SectionLabel>{blockLabel(b.id)}</SectionLabel>}
                <ChipGroup className="pe-mtiles">
                  {b.muscles.map((m) => {
                    const on = chosen.includes(m);
                    return (
                      <Chip
                        key={m}
                        selected={on}
                        icon={on ? 'check' : undefined}
                        aria-pressed={on}
                        onClick={c.readOnly ? undefined : () => c.onToggleMuscle(m)}
                      >
                        {t.muscleGroups[m] ?? m}
                      </Chip>
                    );
                  })}
                </ChipGroup>
              </div>
            ))}
          </div>
          {acts.length > 0 && (
            <ul className="pe-xl" aria-label={p.edActivitiesBeside}>
              <li className="pe-xsub">{p.edActivitiesBeside}</li>
              {acts.map(actRow)}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="pe-xh" aria-hidden>
            <span>{p.edColExercise}</span>
            <span className="pe-xcols">
              <span>{p.edColSets}</span>
              <span>{p.edColTarget}</span>
            </span>
          </div>
          <ul className="pe-xl pe-table" aria-label={p.edTable(title)}>
            {items.map(exRow)}
            {acts.length > 0 && <li className="pe-xsub">{p.edActivitiesBeside}</li>}
            {acts.map(actRow)}
          </ul>
        </>
      )}

      {!c.readOnly && (
        <div className="pe-dc-f">
          <Button variant="secondary" size="sm" icon="plus" onClick={c.onAddExercise}>
            {p.edAddExercise}
          </Button>
          {c.features.activities && (
            <Button variant="secondary" size="sm" icon="heartbeat" onClick={c.onAddActivity}>
              {p.edAddActivity}
            </Button>
          )}
          {c.features.preview && (
            <Button variant="ghost" size="sm" icon="eye" onClick={c.onPreview}>
              {p.edPreview(firstName(c.audience))}
            </Button>
          )}
          <span className="pe-grow" />
          {c.features.copyDay && (
            <Button variant="ghost" size="sm" icon="copy" onClick={c.onCopyDay}>
              {p.edCopyDay}
            </Button>
          )}
          {c.features.library && (
            <Button variant="ghost" size="sm" icon="copy" onClick={c.onLibrary}>
              {p.edCopyTemplate}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
