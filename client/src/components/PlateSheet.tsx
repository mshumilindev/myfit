/**
 * Plate calculator (design "Load entry", feature A). Opens from the weight field
 * on a barbell set: type a total and see what goes on the bar per side, or build
 * it by tapping plates. Bar weight, plate unit (kg/lb) and collars are
 * selectable; when a total isn't loadable it snaps to the closest you can make.
 * The set always stores canonical kg — this only helps you load the bar.
 */
import { useState } from 'react';
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

/** Weight value without a unit suffix — integer when whole, else 1 decimal. */
const fmtW = (kg: number): string => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));

/** Disc height (px) scaled by denomination for the barbell drawing. */
function discHeight(denom: number, unit: PlateUnit): number {
  const kg = unit === 'kg' ? denom : lbToKg(denom);
  return Math.round(18 + Math.min(kg, 25) * 2.1); // ~20px (0.5 kg) → ~70px (25 kg)
}

function Barbell({ perSide, unit }: { perSide: number[]; unit: PlateUnit }) {
  const discW = 11;
  const gap = 2;
  const stackW = perSide.length * (discW + gap) + 22;
  const W = Math.max(200, stackW * 2 + 40);
  const H = 84;
  const mid = H / 2;
  const cx = W / 2;
  const disc = (side: 1 | -1) =>
    perSide.map((d, i) => {
      const h = discHeight(d, unit);
      const x = cx + side * (14 + i * (discW + gap)) - (side === 1 ? 0 : discW);
      return (
        <rect
          key={`${side}-${i}`}
          x={x}
          y={mid - h / 2}
          width={discW}
          height={h}
          rx={2}
          fill={plateColor(d, unit)}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.6"
        />
      );
    });
  return (
    <svg className="pl-bar" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden>
      {/* bar shaft */}
      <rect x={cx - stackW} y={mid - 3} width={stackW * 2} height={6} rx={3} fill="#6b727c" />
      {/* centre knurl */}
      <rect x={cx - 20} y={mid - 4} width={40} height={8} rx={2} fill="#8a9099" />
      {disc(1)}
      {disc(-1)}
    </svg>
  );
}

export function PlateSheet(props: {
  targetKg: number;
  onApply: (kg: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<'solve' | 'build'>('solve');
  const [unit, setUnit] = useState<PlateUnit>('kg');
  const [barKg, setBarKg] = useState(20);
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
        <div className="seg2 pl-mode">
          <button className={mode === 'solve' ? 'active' : ''} onClick={() => setMode('solve')}>
            {t.plateSolve}
          </button>
          <button
            className={mode === 'build' ? 'active' : ''}
            onClick={() => {
              setMode('build');
              if (built.length === 0)
                setBuilt(solvePlates(target, { barKg, unit, collarKg }).perSide);
            }}
          >
            {t.plateBuild}
          </button>
        </div>
      </div>

      {mode === 'solve' && (
        <label className="pl-target">
          <span>{t.plateTarget}</span>
          <div className="pl-target-in">
            <input
              type="number"
              min={barKg}
              step="0.5"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))}
            />
            <em>kg</em>
          </div>
        </label>
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
                <span
                  key={i}
                  className="pl-chip"
                  style={{ borderColor: plateColor(p.denom, unit) }}
                >
                  <span className="pl-dot" style={{ background: plateColor(p.denom, unit) }} />
                  {p.count > 1 ? `${p.count}×` : ''}
                  {p.denom}
                </span>
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
              <button
                key={d}
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
              </button>
            );
          })}
          {built.length > 0 && (
            <button
              className="pl-rack-clear"
              onClick={() => setBuilt([])}
              aria-label={t.plateClear}
            >
              <Icon name="eraser" />
            </button>
          )}
        </div>
      )}

      <div className="pl-controls">
        <div className="pl-ctl">
          <span className="pl-ctl-label">{t.plateBar}</span>
          <div className="pl-chips">
            {bars.map((b) => (
              <button
                key={b.label}
                className={`pl-optchip${Math.abs(b.kg - barKg) < 0.05 ? ' on' : ''}`}
                onClick={() => setBarKg(b.kg)}
              >
                {b.label}
                {unit === 'lb' ? ' lb' : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="pl-ctl-row">
          <div className="seg2 pl-unit">
            {(['kg', 'lb'] as PlateUnit[]).map((u) => (
              <button
                key={u}
                className={unit === u ? 'active' : ''}
                onClick={() => {
                  setUnit(u);
                  setBarKg(u === 'kg' ? 20 : lbToKg(45));
                  setBuilt([]);
                }}
              >
                {u}
              </button>
            ))}
          </div>
          <button
            className={`pl-optchip${collar ? ' on' : ''}`}
            onClick={() => setCollar((c) => !c)}
          >
            {t.plateCollars}
          </button>
        </div>
      </div>

      <button className="btn btn-primary pl-apply" onClick={apply}>
        <Icon name="check" weight="bold" />
        {t.plateApply(fmtW(total))}
      </button>
    </Sheet>
  );
}
