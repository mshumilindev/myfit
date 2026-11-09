/**
 * "Auto by the sun" for the colour mode (Studio settings): day = light, night = dark. No location is asked for: the
 * latitude is a fixed middle value for the markets the app serves (Ukraine, Poland, Lithuania, Estonia: 48-59 N) and
 * the longitude comes from the time zone's STANDARD offset, so sunrise and sunset are right within about half an hour.
 */
const RAD = Math.PI / 180;
export const SUN_LATITUDE = 53;

/** Standard (non-DST) UTC offset of the device in minutes, east positive. */
export function standardOffsetMinutes(d: Date): number {
  const y = d.getFullYear();
  const jan = new Date(y, 0, 1).getTimezoneOffset();
  const jul = new Date(y, 6, 1).getTimezoneOffset();
  return -Math.max(jan, jul);
}

/** Sunrise and sunset of the day of `d` as UTC hours (fractional), or null in polar day / night with the flag. */
export function sunTimesUtc(
  d: Date,
  latitude = SUN_LATITUDE,
  longitude = standardOffsetMinutes(d) / 4,
): { rise: number; set: number } | 'day' | 'night' {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((d.getTime() - start) / 86_400_000);
  const b = (2 * Math.PI * (n - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b); // minutes
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + n)) / 365) * RAD;
  const cosH = -Math.tan(latitude * RAD) * Math.tan(decl);
  if (cosH >= 1) return 'night';
  if (cosH <= -1) return 'day';
  const half = Math.acos(cosH) / RAD / 15; // hours
  const noon = 12 - longitude / 15 - eot / 60;
  return { rise: noon - half, set: noon + half };
}

/** True between sunrise and sunset. */
export function isDaylight(d: Date = new Date()): boolean {
  const t = sunTimesUtc(d);
  if (t === 'day') return true;
  if (t === 'night') return false;
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  const { rise, set } = t;
  // the window can wrap past UTC midnight in far-east zones: compare on a 24 h circle
  const norm = (x: number) => ((x % 24) + 24) % 24;
  const r = norm(rise);
  const s = norm(set);
  return r <= s ? h >= r && h < s : h >= r || h < s;
}
