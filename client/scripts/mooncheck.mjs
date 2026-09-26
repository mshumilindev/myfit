import { moonInfo, illumPct } from '../src/moon.ts';
const checks = [
  ['2026-09-08', 'today — waning crescent, thin', 'waningCrescent'],
  ['2026-09-11', 'new moon', 'new'],
  ['2026-09-18', 'first quarter', 'firstQuarter'],
  ['2026-09-26', 'full moon', 'full'],
  ['2026-01-03', 'full moon', 'full'],
  ['2026-01-18', 'new moon', 'new'],
  ['2026-04-02', 'full moon', 'full'],
  ['2026-06-15', 'new moon', 'new'],
  ['2026-12-24', 'full moon', 'full'],
];
for (const [d, note, exp] of checks) {
  const m = moonInfo(new Date(d + 'T21:00:00'));
  const ok = m.name === exp ? 'OK ' : 'XX ';
  console.log(
    `${ok}${d}  ${m.name.padEnd(15)} ${String(illumPct(m)).padStart(3)}%  waxing=${m.waxing}  (${note})`,
  );
}
