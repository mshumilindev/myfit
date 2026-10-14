import { useMemo } from 'react';
import { ExerciseRow } from '../../../../components/ui/ExerciseRow';
import { SectionLabel } from '../../../../components/ui/SectionLabel';
import { SessionExercise } from '../../../../components/ui/SessionExercise';
import { Icon } from '../../../../ui';
import type { CatalogHit } from '../../host';
import { dayItems, isBare, type ProgramItemDoc } from '../../model/doc';
import { MuscleMap } from '../MuscleMap';
import { firstName, prescriptionLine, stripText } from '../text';
import { Pane, PaneCtx } from './PaneShared';

export function MusclesPane({ c }: { c: PaneCtx }) {
  const { p, t } = c;
  const chosen = useMemo(
    () => c.draft.targetMuscles[String(c.day)] ?? [],
    [c.draft.targetMuscles, c.day],
  );
  const first = firstName(c.audience);
  const sug = useMemo(() => {
    const out = new Map<string, CatalogHit>();
    for (const m of chosen.filter((x) => x !== 'fullbody').slice(0, 4))
      for (const h of c.host.catalog.search({ muscle: m, limit: 3 }))
        if (!out.has(h.name)) out.set(h.name, h);
    return [...out.values()].slice(0, 5);
  }, [chosen, c.host.catalog]);
  return (
    <Pane label={p.edInspMuscles} readOnly={c.readOnly}>
      <SectionLabel>{p.edMuscleMap}</SectionLabel>
      <MuscleMap
        host={c.host}
        selected={chosen}
        labels={{ front: p.edMapFront, back: p.edMapBack }}
        locked
        className="pe-map"
      />
      <p className="pe-map-cap">
        {chosen.length ? chosen.map((m) => t.muscleGroups[m] ?? m).join(' · ') : p.edTapBody}
      </p>
      <SectionLabel>{p.edSuggested}</SectionLabel>
      <p className="pe-p is-note">
        <Icon name="info" /> {p.edPicksNote(first)}
      </p>
      {sug.length ? (
        <ul className="pe-pick">
          {sug.map((x) => (
            <li key={x.name}>
              <ExerciseRow
                name={x.name}
                image={x.image}
                sub={[
                  t.muscleGroups[x.muscle] ?? x.muscle,
                  x.equipment ? t.equipmentLabel(x.equipment) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={<Icon name="plus" aria-label={p.edAddSwitch} />}
                aria-label={`${x.name}: ${p.edAddSwitch}`}
                onClick={() => c.addExercise(x.name)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="pe-p">{p.edChooseMuscle}</p>
      )}
    </Pane>
  );
}

/** "<Client> sees" for the whole day: the program row for every exercise, then the live session, bare and with targets. */
export function DayAsClient({ c }: { c: PaneCtx }) {
  const { p, t } = c;
  const Custom = c.host.slots?.preview;
  if (Custom)
    return (
      <Pane label={p.edInspSees(firstName(c.audience))} readOnly={c.readOnly}>
        <Custom
          doc={c.draft}
          day={c.day}
          item={null}
          audience={c.audience}
          labels={p}
          words={t}
          host={c.host}
        />
      </Pane>
    );
  const first = firstName(c.audience);
  const lifts = dayItems(c.draft, c.day).filter((i) => i.kind === 'strength');
  const bare = lifts.find((i) => isBare(i));
  const targeted = lifts.find((i) => !isBare(i));
  const session = (it: ProgramItemDoc) => (
    <SessionExercise
      preview
      name={it.name}
      muscles={c.host.catalog
        .facts(it.name)
        .muscles.slice(0, 2)
        .map((m) => t.muscleGroups[m] ?? m)
        .join(', ')}
      target={stripText(it, p) || undefined}
      noTarget={p.edPrevNoTarget}
      setLabel={p.edPrevSetN(1)}
      kgPlaceholder={p.edPrevKg}
      repsPlaceholder={p.edPrevReps}
      caption={isBare(it) ? p.edPrevBareCap(first) : p.edPrevTargetCap(first)}
    />
  );
  return (
    <Pane label={p.edInspSees(first)} readOnly={c.readOnly}>
      <SectionLabel>{p.edPrevView}</SectionLabel>
      <ul className="pe-cv-day">
        {lifts.map((it) => (
          <li key={it.id}>
            <ExerciseRow
              name={it.name}
              image={c.host.catalog.facts(it.name).image}
              thumb={40}
              prescription={isBare(it) ? undefined : prescriptionLine(it, p)}
              dense
            />
          </li>
        ))}
      </ul>
      {bare && (
        <>
          <SectionLabel>{p.edPrevJust}</SectionLabel>
          {session(bare)}
        </>
      )}
      {targeted && (
        <>
          <SectionLabel>{p.edPrevTargets}</SectionLabel>
          {session(targeted)}
        </>
      )}
      <p className="pe-p">{p.edPrevFoot(first)}</p>
    </Pane>
  );
}
