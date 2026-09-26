/**
 * Line glyphs for home moves (design "Spotter — Home set"): the icon a move
 * carries in the picker, the home-set cards and the session. Own moves pick one
 * of these; catalog moves have one assigned. Drawn inline (1em, currentColor)
 * so they sit in the same <i className="ui-icon"> slot as the Phosphor icons.
 */
import type { CSSProperties } from 'react';
import type { HomeIcon } from '../homeSets';

const PATHS: Record<HomeIcon, string[]> = {
  hand: [
    'M8 11V5.5a1.5 1.5 0 013 0V10M11 9.5V4.5a1.5 1.5 0 013 0V10M14 10V6a1.5 1.5 0 013 0v7.5a6.5 6.5 0 01-11.6 4l-2.6-3.4a1.6 1.6 0 012.4-2L8 14V11',
  ],
  bar: [
    'M3 4.5h18',
    'M8 4.5v4M16 4.5v4',
    'M12 8.5a2 2 0 110 4 2 2 0 010-4z',
    'M12 12.5v5M9 21l3-3.5 3 3.5M8 8.5l4 2 4-2',
  ],
  pushup: [
    'M5 8.2a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z',
    'M7 11.5l12 3M9 12l-.5 5M19 14.5v3M3 19.5h18',
  ],
  vacuum: [
    'M12 2.7a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z',
    'M12 7v5M8 21l2-6h4l2 6',
    'M8.5 9.5c1 .6 1.5 1.6 1.5 2.8M15.5 9.5c-1 .6-1.5 1.6-1.5 2.8',
    'M10.5 12.5c.8.6 2.2.6 3 0',
  ],
  dip: [
    'M12 3.2a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z',
    'M12 7.5v6M5 11h4l3 2.5 3-2.5h4M5 11v9M19 11v9M12 13.5l-2 5M12 13.5l2 5',
  ],
  squat: [
    'M11 2.7a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z',
    'M11 7v5.5l4 1.5-1 6M11 12.5l-3.5 1.5 1 6M8 9h8',
  ],
  plank: [
    'M4.5 9.2a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z',
    'M6.5 12.5L20 14M7 13l.5 4.5h2.5M20 14v3.5M3 19.5h18',
  ],
  body: ['M12 2.5a2 2 0 110 4 2 2 0 010-4z', 'M6 8.5h12M12 8.5v6M9 21l3-6.5 3 6.5'],
  door: ['M6 21V4h12v17M3.5 21h17M14.5 12.5h.01'],
  bolt: ['M13 3L5 14h6l-1 7 8-11h-6z'],
  timer: ['M12 5.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z', 'M12 13V9M10 2.5h4M18.5 6.5l1.2-1.2'],
  spark: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
};

export function HomeMoveIcon({
  icon,
  className,
  style,
}: {
  icon: HomeIcon | string;
  className?: string;
  style?: CSSProperties;
}) {
  const paths = PATHS[icon as HomeIcon] ?? PATHS.body;
  return (
    <i
      className={['ui-icon', 'hm-icon', className].filter(Boolean).join(' ')}
      aria-hidden
      style={style}
    >
      <svg
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </i>
  );
}
