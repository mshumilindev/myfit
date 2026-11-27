/** SPO-639 W11: nightly hygiene report. Pure: decides what is stale; never deletes anything. */
const DAY = 86400000;

/** @param {{name:string,mergedIntoMain:boolean,lastCommit:string}[]} branches */
export function staleBranches(branches, now = Date.now(), { mergedDays = 7, openDays = 30 } = {}) {
  return branches
    .map((b) => ({ ...b, ageDays: Math.floor((now - Date.parse(b.lastCommit)) / DAY) }))
    .filter(
      (b) =>
        b.name !== 'main' && (b.mergedIntoMain ? b.ageDays >= mergedDays : b.ageDays >= openDays),
    )
    .sort((a, b) => b.ageDays - a.ageDays);
}

/** ready-for-cpd/* that are not merged are work waiting for `cpd`, never "stale" noise: list them separately. */
export function renderHygiene(branches, now = Date.now()) {
  const waiting = branches.filter((b) => b.name.startsWith('ready-for-cpd/') && !b.mergedIntoMain);
  const stale = staleBranches(branches, now).filter(
    (b) => !b.name.startsWith('ready-for-cpd/') || b.mergedIntoMain,
  );
  const row = (b) =>
    `- \`${b.name}\` · ${b.ageDays ?? Math.floor((now - Date.parse(b.lastCommit)) / DAY)} дн. · ${b.mergedIntoMain ? 'змерджена' : 'не змерджена'}`;
  return [
    '## Нічна гігієна гілок',
    '',
    `Чекають на \`cpd\` (${waiting.length}):`,
    ...(waiting.length ? waiting.map(row) : ['- —']),
    '',
    `Застарілі (${stale.length}): змерджені ≥7 дн. або відкриті ≥30 дн.`,
    ...(stale.length ? stale.map(row) : ['- —']),
    '',
    'Звіт лише читає: видалення гілок — рішення людини.',
    '',
  ].join('\n');
}
