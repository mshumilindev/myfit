import { moonInfo, illumPct } from '../src/moon.ts';
// Arbitrary dates across many years — must all be correct, not just 2026.
const dates = [
  '2019-01-21', // known full (total lunar eclipse)
  '2024-04-08', // known new (solar eclipse)
  '2025-03-14', // known full (lunar eclipse)
  '2027-08-02', // known new (solar eclipse)
  '2030-06-01', // known new (solar eclipse)
  '2033-12-06',
];
for (const d of dates) {
  const m = moonInfo(new Date(d + 'T21:00:00'));
  console.log(`${d}  ${m.name.padEnd(15)} ${String(illumPct(m)).padStart(3)}%`);
}
console.log(
  'today ->',
  (() => {
    const m = moonInfo(new Date());
    return `${m.name} ${illumPct(m)}%`;
  })(),
);
