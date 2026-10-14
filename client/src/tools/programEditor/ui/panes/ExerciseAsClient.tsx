import { ExerciseRow } from '../../../../components/ui/ExerciseRow';
import { SectionLabel } from '../../../../components/ui/SectionLabel';
import { SessionExercise } from '../../../../components/ui/SessionExercise';
import { isBare, type ProgramItemDoc } from '../../model/doc';
import { firstName, prescriptionLine, stripText } from '../text';
import { PaneCtx } from './PaneShared';

/** What the client sees for ONE row: program view row + the first set in the session, drawn by the kit pieces the client uses. */
export function ExerciseAsClient({
  it,
  c,
}: {
  it: ProgramItemDoc;
  c: Pick<PaneCtx, 'p' | 't' | 'audience' | 'host'>;
}) {
  const { p, t } = c;
  const Custom = c.host.slots?.preview;
  const f = c.host.catalog.facts(it.name);
  const first = firstName(c.audience);
  const strip = stripText(it, p);
  if (Custom)
    return (
      <Custom
        doc={null}
        day={it.day}
        item={it}
        audience={c.audience}
        labels={p}
        words={t}
        host={c.host}
      />
    );
  return (
    <div className="pe-cv">
      <SectionLabel>{p.edPrevProgram}</SectionLabel>
      <ExerciseRow
        name={it.name}
        image={f.image}
        thumb={40}
        prescription={isBare(it) ? undefined : prescriptionLine(it, p)}
        chevron={!isBare(it)}
        dense
      />
      <SectionLabel>{p.edPrevSession}</SectionLabel>
      <SessionExercise
        preview
        name={it.name}
        muscles={f.muscles
          .slice(0, 2)
          .map((m) => t.muscleGroups[m] ?? m)
          .join(', ')}
        target={strip || undefined}
        noTarget={p.edPrevNoTarget}
        setLabel={p.edPrevSetN(1)}
        kgPlaceholder={p.edPrevKg}
        repsPlaceholder={p.edPrevReps}
        caption={isBare(it) ? p.edPrevBareCap(first) : p.edPrevTargetCap(first)}
      />
    </div>
  );
}

/* ---- exercise row ------------------------------------------------------------------------------------------- */
