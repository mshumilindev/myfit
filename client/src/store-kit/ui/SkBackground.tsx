import { cx } from '../cx';
import '../tokens-e.css';
import './SkBackground.css';

/** Three wave layers: path inside a 400-wide tile, tile height. Tones come from --wave-1..3. */
const LAYERS = [
  { n: 1, h: 170, d: 'M0 70 C50 32 150 32 200 70 S350 108 400 70 V0 H0Z' },
  { n: 2, h: 210, d: 'M0 90 C50 60 150 60 200 90 S350 120 400 90 V0 H0Z' },
  { n: 3, h: 250, d: 'M0 110 C50 84 150 84 200 110 S350 136 400 110 V0 H0Z' },
] as const;
/** Tiles per layer: 10 x 25rem covers any realistic viewport width plus the drift distance. */
const TILES = Array.from({ length: 10 }, (_, i) => i);

/**
 * Animated layered waves behind the app. Decorative (aria-hidden, no pointer events), sits at --sk-z-bg inside
 * `.sk-root`. Three inline-SVG layers drift horizontally at different speeds; `prefers-reduced-motion` or
 * `still` freezes them. Place it as the first child of the root.
 */
export function SkBackground({
  still,
  contained,
  className,
}: {
  /** Freeze the animation (static waves). */
  still?: boolean;
  /** Position inside the nearest positioned ancestor instead of the viewport. */
  contained?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid="sk-bg"
      className={cx('sk-bg', still && 'sk-bg-still', contained && 'sk-bg-in', className)}
    >
      {LAYERS.map((l) => (
        <div key={l.n} className={cx('sk-wv', `sk-wv-${l.n}`)}>
          {TILES.map((i) => (
            <svg key={i} viewBox={`0 0 400 ${l.h}`} preserveAspectRatio="none" focusable="false">
              <path d={l.d} fill="currentColor" />
            </svg>
          ))}
        </div>
      ))}
    </div>
  );
}
