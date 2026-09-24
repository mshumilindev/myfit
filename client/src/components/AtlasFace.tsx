/**
 * Atlas's face — one generated portrait per temper (public/atlas/atlas-N.webp):
 * the smile fades and the brow drops as the temper heats up, the light takes
 * the temper colour. The ring shows the colour too.
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
  // The portrait for this temper (one face, five moods, lit in the temper colour).
  return (
    <span
      className="atl-face"
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundColor: TINT[temper],
        backgroundImage: `url(/atlas/atlas-${temper}.webp)`,
        boxShadow: ring ? `inset 0 0 0 ${size < 60 ? 1.5 : 2}px ${c}aa` : undefined,
      }}
    />
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
