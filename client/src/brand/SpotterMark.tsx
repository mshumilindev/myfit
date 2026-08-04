/** Brand mark — transparent gold Spotter glyph (not Phosphor). */
import { iconSrcFor, type SpotterMarkVariant } from './spotterIcons';

export function SpotterMark({
  size = 28,
  variant = 'tight',
  className,
  alt = '',
}: {
  /** CSS display size in px. Asset is chosen at ≥2× for retina detail. */
  size?: number;
  /** sidebar = rail; tight = small UI; glyph = padded for larger surfaces. */
  variant?: SpotterMarkVariant;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={['spotter-mark', `spotter-mark--${variant}`, className].filter(Boolean).join(' ')}
      src={iconSrcFor(variant, size)}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}
