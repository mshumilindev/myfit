/** SPO-639 W10: post-deploy error threshold. Input = log entries (gcloud logging read --format=json) after the deploy. */
const RANK = {
  DEFAULT: 0,
  DEBUG: 1,
  INFO: 2,
  NOTICE: 3,
  WARNING: 4,
  ERROR: 5,
  CRITICAL: 6,
  ALERT: 7,
  EMERGENCY: 8,
};

export function countErrors(entries) {
  return entries.filter(
    (e) => (RANK[String(e.severity ?? 'DEFAULT').toUpperCase()] ?? 0) >= RANK.ERROR,
  ).length;
}

/** Fails when errors exceed the absolute cap or the share of all entries. */
export function evaluateGate(entries, { maxErrors = 5, maxSharePct = 2 } = {}) {
  const errors = countErrors(entries);
  const total = entries.length;
  const share = total ? (errors / total) * 100 : 0;
  const ok = errors <= maxErrors && share <= maxSharePct;
  return { ok, errors, total, sharePct: +share.toFixed(2), maxErrors, maxSharePct };
}
