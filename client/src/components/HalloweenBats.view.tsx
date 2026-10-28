import { useMemo, type CSSProperties } from 'react';
import { BAT_ROWS, BAT_STAGE } from './halloweenBats.generated';
import './halloweenBats.generated.css';
import './HalloweenBats.css';

const WING =
  'M47 27C38 20 24 13 5 15C10 21 9 28 6 35C12 32 16 33 19 38C22 36 27 37 30 42C34 40 40 41 47 47Z';

/** Per-bat geometry and animation names are data (generated), so they are set as inline values, not classes. */
const batStyle = (sz: number, key: string, i: number): CSSProperties => ({
  width: sz,
  height: sz * 0.62,
  margin: `${-sz * 0.31}px 0 0 ${-sz / 2}px`,
  ['--in' as string]: `${key}${i}i`,
  ['--hold' as string]: `${key}${i}h`,
  ['--out' as string]: `${key}${i}o`,
});
const flapStyle = (d: number, o: number): CSSProperties => ({
  animationDuration: `${d}s`,
  animationDelay: `-${o}s`,
});

export default function HalloweenBatsView() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const key: 'p' | 'd' = vw >= 720 ? 'd' : 'p';
  const { w, h } = BAT_STAGE[key];
  const k = Math.max(vw / w, vh / h);
  const style = useMemo<CSSProperties>(
    () => ({
      width: w,
      height: h,
      transform: `translate(${(vw - w * k) / 2}px, ${(vh - h * k) / 2}px) scale(${k})`,
    }),
    [w, h, k, vw, vh],
  );
  return (
    <div className="hw-bats" aria-hidden="true" data-testid="halloween-bats">
      <div className="hw-veil" />
      <div className="hw-stage" style={style}>
        {BAT_ROWS[key].map(([sz, d, o, o2], i) => (
          <div className="hwb" key={i} style={batStyle(sz, key, i)}>
            <svg viewBox="0 0 100 62" overflow="visible">
              <g className="hwb-wa">
                <g className="hwb-wi" style={flapStyle(d, o)}>
                  <path d={WING} />
                </g>
              </g>
              <g transform="translate(100 0) scale(-1 1)">
                <g className="hwb-wa">
                  <g className="hwb-wi" style={flapStyle(d, o2)}>
                    <path d={WING} />
                  </g>
                </g>
              </g>
              <path d="M50 6L46.6 13.5C45 17 45 21 46 24L45 45C46 51 48 56 50 59C52 56 54 51 55 45L54 24C55 21 55 17 53.4 13.5Z" />
              <path d="M46.8 12L44.6 3.5 49.2 9ZM53.2 12L55.4 3.5 50.8 9Z" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
