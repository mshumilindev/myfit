/**
 * Atlas's face — one generated portrait per temper (public/atlas/atlas-N.webp):
 * the smile fades and the brow drops as the temper heats up, the light takes
 * the temper colour. The ring shows the colour too.
 */
import { TEMPER_COLOR, TEMPERS, type Temper } from '../atlas/types';

const TINT: Record<Temper, string> = {
  1: '#132a20',
  3: '#342a13',
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

/** Three bars — green, yellow, red — lit up to the temper: the harshness meter. */
export function TemperHeat({ temper }: { temper: Temper }) {
  return (
    <span className="atl-heat" aria-hidden>
      {TEMPERS.map((i, k) => (
        <span
          key={i}
          style={{ height: 8 + k * 5, background: i <= temper ? TEMPER_COLOR[i] : undefined }}
        />
      ))}
    </span>
  );
}
