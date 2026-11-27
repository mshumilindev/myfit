/** SPO-639 W6: pure CI metrics from GitHub Actions runs/jobs JSON (no network here, so it is testable). */
const sec = (a, b) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 1000);

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

/** @param {{status:string,conclusion:string|null,run_started_at:string,updated_at:string,event:string}[]} runs */
export function summarizeRuns(runs) {
  const done = runs.filter((r) => r.status === 'completed' && r.conclusion !== 'cancelled');
  const wall = done.map((r) => sec(r.run_started_at, r.updated_at)).sort((a, b) => a - b);
  const red = done.filter((r) => r.conclusion !== 'success').length;
  return {
    runs: done.length,
    medianMin: +(percentile(wall, 50) / 60).toFixed(1),
    p90Min: +(percentile(wall, 90) / 60).toFixed(1),
    redPct: done.length ? Math.round((red / done.length) * 100) : 0,
  };
}

/** @param {{name:string,started_at:string|null,completed_at:string|null}[]} jobs */
export function slowestJobs(jobs, n = 5) {
  const byName = new Map();
  for (const j of jobs) {
    if (!j.started_at || !j.completed_at) continue;
    const arr = byName.get(j.name) ?? [];
    arr.push(sec(j.started_at, j.completed_at));
    byName.set(j.name, arr);
  }
  return [...byName]
    .map(([name, v]) => ({
      name,
      medianSec: Math.round(
        percentile(
          [...v].sort((a, b) => a - b),
          50,
        ),
      ),
    }))
    .sort((a, b) => b.medianSec - a.medianSec)
    .slice(0, n);
}
