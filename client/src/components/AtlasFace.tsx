/**
 * Atlas's face — a placeholder avatar until the generated portrait lands.
 * One face, five expressions: brows drop and the mouth hardens as the temper
 * heats up; the ring and glow take the temper colour.
 */
import { TEMPER_COLOR, type Temper } from '../atlas/types';

const TINT: Record<Temper, string> = {
  1: '#132a20',
  2: '#15263a',
  3: '#342713',
  4: '#3a1c13',
  5: '#34121a',
};

export function AtlasFace({
  temper,
  size = 40,
  ring = true,
}: {
  temper: Temper;
  size?: number;
  ring?: boolean;
}) {
  const c = TEMPER_COLOR[temper];
  const by = [0, 15, 16, 16.5, 17, 17.5][temper];
  const d = [0, -0.5, 0, 0.8, 2.2, 3.2][temper];
  const mouth = {
    1: 'M17 30.5 Q24 37 31 30.5',
    2: 'M18 31 Q24 34 30 31',
    3: 'M18.5 32 H29.5',
    4: 'M18 33.5 Q24 30 30 33.5',
    5: 'M18 32.5 Q23 32.5 30.5 29.5',
  }[temper];
  return (
    <span
      className="atl-face"
      aria-hidden
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 25%, ${c}55, ${TINT[temper]} 62%, #111214 100%)`,
        boxShadow: ring ? `inset 0 0 0 ${size < 60 ? 1.5 : 2}px ${c}aa` : undefined,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d={`M13.5 ${by - d} L20.5 ${by + d}`} />
        <path d={`M27.5 ${by + d} L34.5 ${by - d}`} />
        {temper === 1 ? (
          <>
            <path d="M15 23.5q2.5-3 5 0" />
            <path d="M28 23.5q2.5-3 5 0" />
          </>
        ) : temper === 5 ? (
          <>
            <path d="M15 22.5h5" />
            <path d="M28 22.5h5" />
          </>
        ) : (
          <>
            <circle cx={17.5} cy={22.5} r={1.6} fill={c} stroke="none" />
            <circle cx={30.5} cy={22.5} r={1.6} fill={c} stroke="none" />
          </>
        )}
        <path d={mouth} />
      </svg>
    </span>
  );
}

/** Five bars, lit up to the temper — the harshness meter. */
export function TemperHeat({ temper }: { temper: Temper }) {
  return (
    <span className="atl-heat" aria-hidden>
      {([1, 2, 3, 4, 5] as Temper[]).map((i) => (
        <span
          key={i}
          style={{ height: 6 + i * 2, background: i <= temper ? TEMPER_COLOR[i] : undefined }}
        />
      ))}
    </span>
  );
}
