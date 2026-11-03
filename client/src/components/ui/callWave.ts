/** Number of bars in `CallWave`. */
export const WAVE_BARS = 9;

/** Centre bars move most, edge bars least: the shape of an equaliser. */
const ENVELOPE = [0.35, 0.55, 0.75, 0.9, 1, 0.9, 0.75, 0.55, 0.35] as const;

/**
 * Spread one voice level (0..1, e.g. the RMS of the microphone or of the other person) over the bars as steps 1..10.
 * `phase` (any growing number, e.g. the frame counter) offsets each bar so the shape ripples instead of pumping. A silent
 * line (level 0) is the lowest step on every bar.
 */
export function waveSteps(level: number, phase: number): number[] {
  const l = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  return ENVELOPE.map((e, i) => {
    const wobble = 0.6 + 0.4 * Math.abs(Math.sin(phase + i * 0.9));
    return Math.min(10, Math.max(1, Math.round(10 * l * e * wobble)));
  });
}
