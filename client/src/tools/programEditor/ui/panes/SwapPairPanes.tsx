import { ExerciseRow } from '../../../../components/ui/ExerciseRow';
import { dayItems, type ProgramItemDoc } from '../../model/doc';
import { supersetWith, swapExercise } from '../../model/ops';
import { prescriptionLine } from '../text';
import { Head, Pane, PaneCtx } from './PaneShared';

export function SwapPane({ c, it }: { c: PaneCtx; it: ProgramItemDoc }) {
  const { p, t } = c;
  const primary = c.host.catalog.facts(it.name).primary ?? undefined;
  const taken = c.draft.items.filter((i) => i.day === it.day).map((i) => i.name);
  const list = c.host.catalog.search({ muscle: primary, exclude: taken, limit: 8 });
  return (
    <Pane label={p.edInspSwap} readOnly={c.readOnly}>
      <Head c={c} title={it.name} sub={p.edSwapFor(it.name)} />
      <ul className="pe-pick">
        {list.map((x) => (
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
              onClick={() => {
                c.edit((d) => swapExercise(d, it.id, x.name, c.host.catalog));
                c.setPane('edit');
              }}
            />
          </li>
        ))}
        {!list.length && <li className="pe-p">{p.edSwapNone}</li>}
      </ul>
    </Pane>
  );
}

export function PairPane({ c, it }: { c: PaneCtx; it: ProgramItemDoc }) {
  const { p } = c;
  const others = dayItems(c.draft, it.day).filter((i) => i.kind === 'strength' && i.id !== it.id);
  return (
    <Pane label={p.edInspSuperset} readOnly={c.readOnly}>
      <Head c={c} title={it.name} sub={p.edPairWith} />
      <ul className="pe-pick">
        {others.map((x) => (
          <li key={x.id}>
            <ExerciseRow
              name={x.name}
              image={c.host.catalog.facts(x.name).image}
              sub={prescriptionLine(x, p)}
              chevron
              onClick={() => {
                c.edit((d) => supersetWith(d, it.id, x.id));
                c.setPane('edit');
              }}
            />
          </li>
        ))}
      </ul>
    </Pane>
  );
}
