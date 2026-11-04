import { IconTile, type IconTileSize } from './IconTile';
import type { Tone } from './tones';

export type DeviceKind = 'phone' | 'tablet' | 'computer' | 'unknown';

export interface DeviceImageProps {
  /** What the device is (the server derives it from the user-agent); anything else reads as `unknown`. */
  kind?: DeviceKind | string;
  /** `ok` marks this device, `danger` a login to be checked. */
  tone?: Tone;
  size?: IconTileSize;
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** One outline per kind, drawn on a 24-unit grid. */
const GLYPH: Record<DeviceKind, string[]> = {
  phone: ['M8 2h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z', 'M10.5 5h3'],
  tablet: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M11 18.5h2'],
  computer: ['M5 5h14a1 1 0 0 1 1 1v9H4V6a1 1 0 0 1 1-1z', 'M2 19h20'],
  unknown: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    'M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.9-1.1 1.7M12 16.8h.01',
  ],
};

const label: Record<DeviceKind, string> = {
  phone: 'phone',
  tablet: 'tablet',
  computer: 'computer',
  unknown: 'device',
};

function deviceKindOf(kind: unknown): DeviceKind {
  return typeof kind === 'string' && kind in GLYPH ? (kind as DeviceKind) : 'unknown';
}

/**
 * The picture of a device in "My devices" (SPO-436): an outline of its family inside an `IconTile`. Decorative — the row
 * beside it names the model. Real photos are not used: no freely licensed set covers the models (ADR 012).
 */
export function DeviceImage({ kind, tone = 'neutral', size = 44 }: DeviceImageProps) {
  const k = deviceKindOf(kind);
  return (
    <IconTile tone={tone} size={size}>
      <svg viewBox="0 0 24 24" data-device={label[k]} aria-hidden="true">
        {GLYPH[k].map((d) => (
          <path key={d} d={d} {...STROKE} />
        ))}
      </svg>
    </IconTile>
  );
}
