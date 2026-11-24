/**
 * The parts of a drop / reverse-drop set (Set types chunk): the set itself as the first part, then one row per drop, with a
 * trash on each, an "add another drop" row carrying the totals, and the reverse-drop note. The set editor passes its own
 * stepper pair, so the parts look like the rest of the sheet.
 */
import { IconButton } from '../components/ui/Button';
import { IconTile } from '../components/ui/IconTile';
import { ListRow } from '../components/ui/GroupedList';
import { fmtKg, useT } from '../i18n';
import type { DropBodyProps } from '../setTypesApi';
import { Icon } from '../ui';
import { STRINGS } from './strings';

/** The next drop part: fewer reps and (drop) a lighter weight or (reverse) a heavier one, rounded to the plate. */
export function nextDropPart(
  type: 'drop' | 'reverse-drop',
  prev: { reps: number; weight: number | null },
): { reps: number; weight: number | null } {
  return {
    reps: Math.max(1, prev.reps - (type === 'drop' ? 2 : 3)),
    weight:
      prev.weight === null
        ? null
        : Math.max(0, type === 'drop' ? Math.round((prev.weight * 0.75) / 5) * 5 : prev.weight + 5),
  };
}

export function DropBody(props: DropBodyProps) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const { type, reps, weight, drops, setDrops } = props;
  const repsTotal = reps + drops.reduce((n, d) => n + d.reps, 0);
  const kgTotal = (weight ?? 0) * reps + drops.reduce((v, d) => v + (d.weight ?? 0) * d.reps, 0);
  const patch = (i: number, p: Partial<(typeof drops)[number]>) =>
    setDrops((list) => list.map((x, xi) => (xi === i ? { ...x, ...p } : x)));
  return (
    <div className="dropedit-rows">
      <div className="drop-part">
        <div className="drop-part-lab">{s.startLabel}</div>
        {props.firstPart}
      </div>
      {drops.map((d, i) => (
        <div key={i} className="drop-part">
          <div className="drop-part-lab">
            <span>{t.dropRowN(i + 1)}</span>
            <IconButton
              icon="trash"
              size="xs"
              className="drop-trash"
              label={t.delete}
              onClick={() => setDrops((list) => list.filter((_, xi) => xi !== i))}
            />
          </div>
          {props.steppers(
            d.reps,
            d.weight,
            (n) => patch(i, { reps: n }),
            (n) => patch(i, { weight: n }),
            null,
          )}
        </div>
      ))}
      <ListRow
        icon={<IconTile icon="plus" />}
        label={s.addDrop}
        value={s.totals(repsTotal, fmtKg(kgTotal))}
        onClick={() =>
          setDrops((list) => [
            ...list,
            nextDropPart(type, list[list.length - 1] ?? { reps, weight }),
          ])
        }
      />
      {type === 'reverse-drop' && (
        <div className="sheet-note">
          <Icon name="caret-line-up" />
          <p>{s.reverseNote}</p>
        </div>
      )}
    </div>
  );
}
