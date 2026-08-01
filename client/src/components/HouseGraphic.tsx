/**
 * Locally-generated "house graphic" fallback image for a gym (AC-IMG-07):
 * a graphite diagonal weave over a dark gradient with a centred barbell mark.
 * No network, deterministic, crisp at any size from 64 to 320 px. Never
 * labelled "missing" — it is a legitimate, final photo fallback.
 */
export function HouseGraphic({ size = 64 }: { size?: number }) {
  return (
    <svg
      className="house-graphic"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="hg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#23262a" />
          <stop offset="1" stopColor="#1a1c20" />
        </linearGradient>
        <pattern
          id="hg-weave"
          width="11"
          height="11"
          patternTransform="rotate(135)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="11" height="11" fill="transparent" />
          <rect width="2" height="11" fill="rgba(255,255,255,0.035)" />
        </pattern>
      </defs>
      <rect width="64" height="64" fill="url(#hg-bg)" />
      <rect width="64" height="64" fill="url(#hg-weave)" />
      {/* barbell mark, --color-neutral-700 */}
      <g fill="#55595e">
        <rect x="20" y="30" width="24" height="4" rx="2" />
        <rect x="15" y="26" width="4" height="12" rx="1.5" />
        <rect x="45" y="26" width="4" height="12" rx="1.5" />
        <rect x="11" y="28" width="3" height="8" rx="1.5" />
        <rect x="50" y="28" width="3" height="8" rx="1.5" />
      </g>
    </svg>
  );
}
