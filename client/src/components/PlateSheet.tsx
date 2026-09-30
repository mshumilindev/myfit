/**
 * Plate calculator (design "Load entry", feature A). Opens from the weight field
 * on a barbell set: type a total and see what goes on the bar per side, or build
 * it by tapping plates. Bar weight, plate unit (kg/lb) and collars are
 * selectable; when a total isn't loadable it snaps to the closest you can make.
 * The set always stores canonical kg — this only helps you load the bar.
 */
import { Chip } from '../components/ui/Chip';
import { Field } from './ui/Field';
import { useState } from 'react';
import { Button, IconButton } from './ui/Button';
import { Segmented } from './ui/Segmented';
import { Icon, Sheet } from '../ui';
import { useT } from '../i18n';
import {
  solvePlates,
  totalFromPlates,
  plateCounts,
  plateColor,
  BAR_WEIGHTS_KG,
  BAR_WEIGHTS_LB,
  PLATES_KG,
  PLATES_LB,
  lbToKg,
  type PlateUnit,
} from '../plates';
import { Tag } from './ui/Tag';

/** Weight value without a unit suffix — integer when whole, else 1 decimal. */
const fmtW = (kg: number): string => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));

/** Plate height (px) scaled by weight for the barbell drawing. */
function plateHeight(denom: number, unit: PlateUnit): number {
  const kg = unit === 'kg' ? denom : lbToKg(denom);
  return Math.round(40 + Math.min(kg, 25) * 2.4); // ~41px (0.5 kg) → ~100px (25 kg)
}

/**
 * Barbell drawing (design "Load entry"): a long central grip with the loaded
 * plates stacked outboard on both sides — heaviest nearest the collar — capped
 * by sleeves and end caps. Flexbox, mirroring the design's `.bb` component, so
 * the bar reads as a barbell rather than a stubby dumbbell.
 */
function Barbell({ perSide, unit }: { perSide: number[]; unit: PlateUnit }) {
  // Fixed geometry: the grip and both sleeves keep their width; plates live on
  // the sleeves and shrink (never overflow) when a heavy load stacks many.
  const plate = (d: number, key: string) => (
    <span
      key={key}
      className="pl-bb-plate"
      style={{ height: plateHeight(d, unit), background: plateColor(d, unit) }}
    />
  );
  return (
    <div className="pl-bb" aria-hidden>
      <div className="pl-bb-stack">
        <span className="pl-bb-cap" />
        {/* left sleeve: heaviest by the collar, smallest outboard */}
        <span className="pl-bb-side left">
          {[...perSide].reverse().map((d, i) => plate(d, `l${i}`))}
        </span>
        <span className="pl-bb-collar" />
        <span className="pl-bb-grip" />
        <span className="pl-bb-collar" />
        <span className="pl-bb-side right">{perSide.map((d, i) => plate(d, `r${i}`))}</span>
        <span className="pl-bb-cap" />
      </div>
    </div>
  );
}

export function PlateSheet(props: {
  targetKg: number;
  initialUnit?: PlateUnit;
  onApply: (kg: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<'solve' | 'build'>('solve');
  const [unit, setUnit] = useState<PlateUnit>(props.initialUnit ?? 'kg');
  const [barKg, setBarKg] = useState(props.initialUnit === 'lb' ? lbToKg(45) : 20);
  const [collar, setCollar] = useState(false);
  const [target, setTarget] = useState(props.targetKg > 0 ? props.targetKg : 60);
  const [built, setBuilt] = useState<number[]>([]);

  const collarKg = collar ? 2.5 : 0;
  const bars: { kg: number; label: string }[] =
    unit === 'kg'
      ? BAR_WEIGHTS_KG.map((kg) => ({ kg, label: String(kg) }))
      : BAR_WEIGHTS_LB.map((lb) => ({ kg: lbToKg(lb), label: String(lb) }));
  const rack = unit === 'kg' ? PLATES_KG : PLATES_LB;

  const solution =
    mode === 'solve'
      ? solvePlates(target, { barKg, unit, collarKg })
      : {
          perSide: built,
          achievedKg: totalFromPlates(built, { barKg, unit, collarKg }),
          deltaKg: 0,
          exact: true,
          perSideKg: 0,
        };
  const total = solution.achievedKg;

  function apply(): void {
    props.onApply(Math.round(total * 100) / 100);
    props.onClose();
  }
  const addPlate = (d: number) => setBuilt((b) => [...b, d].sort((x, y) => y - x));
  const dropPlate = (d: number) => {
    setBuilt((b) => {
      const i = b.lastIndexOf(d);
      if (i < 0) return b;
      const next = [...b];
      next.splice(i, 1);
      return next;
    });
  };

  return (
    <Sheet onClose={props.onClose} className="plate-sheet">
      <div className="pl-head">
        <div className="pl-title">
          <Icon name="barbell" />
          {t.plateTitle}
        </div>
        <Segmented
          className="pl-mode"
          size="sm"
          options={[
            { value: 'solve', label: t.plateSolve },
            { value: 'build', label: t.plateBuild },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === 'build' && built.length === 0)
              setBuilt(solvePlates(target, { barKg, unit, collarKg }).perSide);
          }}
        />
      </div>

      {mode === 'solve' && (
        <Field
          className="pl-target"
          label={t.plateTarget}
          type="number"
          min={barKg}
          step="0.5"
          inputMode="decimal"
          trail="kg"
          value={target}
          onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))}
        />
      )}

      <Barbell perSide={solution.perSide} unit={unit} />

      <div className="pl-readout">
        <div className="pl-total tnum">
          {fmtW(total)} <em>kg</em>
        </div>
        <div className="pl-perside">
          {solution.perSide.length > 0 ? (
            <>
              <span className="pl-per-label">{t.platePerSide}</span>
              {plateCounts(solution.perSide).map((p, i) => (
                <Tag
                  key={i}
                  tone="neutral"
                  icon={
                    <span className="pl-dot" style={{ background: plateColor(p.denom, unit) }} />
                  }
                >
                  {p.count > 1 ? `${p.count}×` : ''}
                  {p.denom}
                </Tag>
              ))}
            </>
          ) : (
            <span className="pl-per-label">{t.plateBarOnly}</span>
          )}
        </div>
        {mode === 'solve' && !solution.exact && (
          <div className="pl-closest">
            {t.plateClosest(fmtW(total), fmtW(Math.abs(solution.deltaKg)))}
          </div>
        )}
      </div>

      {mode === 'build' && (
        <div className="pl-rack">
          {rack.map((d) => {
            const count = built.filter((x) => x === d).length;
            return (
              <Button
                key={d}
                variant="secondary"
                size="sm"
                className="pl-rack-plate"
                style={{ background: plateColor(d, unit) }}
                onClick={() => addPlate(d)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  dropPlate(d);
                }}
                title={`${d} ${unit}`}
              >
                {d}
                {count > 0 && <span className="pl-rack-count">{count}</span>}
              </Button>
            );
          })}
          {built.length > 0 && (
            <IconButton icon="eraser" size="sm" onClick={() => setBuilt([])} label={t.plateClear} />
          )}
        </div>
      )}

      <div className="pl-controls">
        <div className="pl-ctl">
          <span className="pl-ctl-label">{t.plateBar}</span>
          <div className="pl-chips">
            {bars.map((b) => (
              <Chip
                selected={Math.abs(b.kg - barKg) < 0.05}
                key={b.label}
                onClick={() => setBarKg(b.kg)}
              >
                {b.label}
                {unit === 'lb' ? ' lb' : ''}
              </Chip>
            ))}
          </div>
        </div>
        <div className="pl-ctl-row">
          <Segmented
            className="pl-unit"
            size="sm"
            options={(['kg', 'lb'] as PlateUnit[]).map((u) => ({ value: u, label: u }))}
            value={unit}
            onChange={(u) => {
              setUnit(u);
              setBarKg(u === 'kg' ? 20 : lbToKg(45));
              setBuilt([]);
            }}
          />
          <Chip selected={collar} onClick={() => setCollar((c) => !c)}>
            {t.plateCollars}
          </Chip>
        </div>
      </div>

      <Button variant="primary" className="pl-apply" onClick={apply}>
        <Icon name="check" weight="bold" />
        {t.plateApply(fmtW(total))}
      </Button>
    </Sheet>
  );
}
