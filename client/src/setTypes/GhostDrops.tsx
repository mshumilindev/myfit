import { useT } from '../i18n';
import type { GhostDropsProps } from '../setTypesApi';
import { SetNumberInput } from '../views/SetNumberInput';
import { STRINGS } from './strings';

/** The parts of a drop / reverse-drop set on the "next set" card: the start, then one stepper pair per drop. */
export function GhostDrops(p: GhostDropsProps) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  const wLabel = p.unit === 'lb' ? t.weightLb : t.weightKg;
  return (
    <div className="gset-drops">
      <div className="gset-part">
        <div className="gset-part-lab">{s.startLabel}</div>
        <div className="gset-steppers">
          <SetNumberInput field="reps" label={t.reps} value={p.reps} onChange={p.onReps} />
          <SetNumberInput
            field="weight"
            unit={p.unit}
            label={wLabel}
            value={p.toDisp(p.weightKg ?? 0)}
            disabled={p.bodyweight}
            placeholder={t.bodyweightShort}
            onChange={(x) => p.onStartWeight(p.fromDisp(x))}
          />
        </div>
      </div>
      {p.drops.map((d, i) => (
        <div className="gset-part" key={i}>
          <div className="gset-part-lab">{t.dropRowN(i + 1)}</div>
          <div className="gset-steppers">
            <SetNumberInput
              field="reps"
              label={t.reps}
              value={d.reps}
              onChange={(n) => p.onPatch(i, { reps: n })}
            />
            <SetNumberInput
              field="weight"
              unit={p.unit}
              label={wLabel}
              value={p.toDisp(d.weight ?? 0)}
              disabled={d.weight === null}
              placeholder={t.bodyweightShort}
              onChange={(x) => p.onPatch(i, { weight: p.fromDisp(x) })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
