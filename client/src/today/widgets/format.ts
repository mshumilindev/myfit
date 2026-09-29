/** Small formatting helpers shared by Today widgets. */
export const DAY = 24 * 3600 * 1000;

/** 510 → "8h 30m". */
export function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** 02:05 from epoch ms (local). */
export function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Signed with a real minus: −0.6 / +2.5. */
export function signed(n: number, digits = 1): string {
  const v = Number(n.toFixed(digits));
  if (v === 0) return '±0';
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}

export function pct(n: number): number {
  return Math.round(n * 100);
}
