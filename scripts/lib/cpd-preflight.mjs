/**
 * SPO-639: pre-flight for `cpd`. Every `ready-for-cpd/*` branch (local or on origin) must be either
 * deployed together with this cpd (ahead of main) or closed as already merged. Pure so it can be tested.
 */
export function classifyReady(branches) {
  const toInclude = branches.filter((b) => b.ahead > 0);
  const stale = branches.filter((b) => b.ahead === 0);
  return { toInclude, stale };
}

/** Shards are stale when the journal has events newer than the newest shard (judged by event time, not by SHA). */
export function captureFreshness({ journalTs, shardTs, slackMs = 5 * 60 * 1000 }) {
  if (typeof journalTs !== 'number') return { stale: false, ageMs: 0 };
  if (typeof shardTs !== 'number') return { stale: true, ageMs: null };
  const ageMs = Math.max(0, journalTs - shardTs);
  return { stale: ageMs > slackMs, ageMs };
}

export function renderPreflight({ branches, unpushed, dirty, capture }) {
  const { toInclude, stale } = classifyReady(branches);
  const lines = ['[cpd-preflight]'];
  lines.push(`незапушених комітів на main: ${unpushed}; змінених файлів: ${dirty}`);
  if (toInclude.length === 0 && stale.length === 0) lines.push('ready-for-cpd/*: немає');
  for (const b of toInclude)
    lines.push(
      `ВКЛЮЧИ в цей cpd: ${b.name} (+${b.ahead} комітів; rebase на origin/main, деплой разом)`,
    );
  for (const b of stale) lines.push(`вже в main, прибери після cpd: ${b.name} (git branch -d)`);
  if (capture && capture.stale)
    lines.push(
      'дашборд: шарди запису застарілі відносно журналу; закоміть docs/reviews/dash/ (roll-up робить рекордер на Stop)',
    );
  if (toInclude.length) lines.push('cpd НЕ завершений, поки ці гілки не задеплоєно.');
  return lines.join('\n');
}
