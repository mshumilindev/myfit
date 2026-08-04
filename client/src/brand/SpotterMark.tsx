/** Brand mark — Spotter glyph on accent-100 plate (design token). */
import { iconSrcFor, type SpotterMarkVariant } from './spotterIcons';

export function SpotterMark({
  size = 28,
  variant = 'tight',
  className,
  alt = '',
  plate = true,
}: {
  /** CSS display size in px. Asset is chosen at ≥2× for retina detail. */
  size?: number;
  /** sidebar = rail; tight = small UI; glyph = padded for larger surfaces. */
  variant?: SpotterMarkVariant;
  className?: string;
  alt?: string;
  /** Light brass plate (`--color-accent-100`). Off only if the parent paints one. */
  plate?: boolean;
}) {
  const img = (
    <img
      className={['spotter-mark', `spotter-mark--${variant}`, !plate ? className : undefined]
        .filter(Boolean)
        .join(' ')}
      src={iconSrcFor(variant, size)}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
  if (!plate) return img;
  return (
    <span
      className={['spotter-mark-plate', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    >
      {img}
    </span>
  );
}
