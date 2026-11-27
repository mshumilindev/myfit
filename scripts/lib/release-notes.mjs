/** SPO-639 W10: release notes from git commit subjects (pure; no network, no personal data). */
const TASK = /\bSPO-\d+\b/g;
const KIND = [
  ['fix', /^(Фікс|Виправлення|Fix)(?![\p{L}])/iu],
  ['feat', /^(Фіча|Нове|Додано|Feat)(?![\p{L}])/iu],
  ['docs', /^(Док|Docs?)(?![\p{L}])/iu],
];

/** @param {string[]} subjects commit subjects, newest first */
export function parseSubjects(subjects) {
  return subjects
    .map((s) => s.trim())
    .filter((s) => s && !/^Merge\b/.test(s))
    .map((s) => ({
      text: s.replace(/[\s,]*\(?\bSPO-\d+(?:[,\s]+SPO-\d+)*\b[^)(]*\)?\s*$/, '').trim() || s,
      tasks: [...new Set(s.match(TASK) ?? [])],
      kind: KIND.find(([, re]) => re.test(s))?.[0] ?? 'other',
    }));
}

const TITLES = { feat: 'Нове', fix: 'Виправлення', docs: 'Документація', other: 'Інше' };

export function renderNotes({ version, date, subjects }) {
  const items = parseSubjects(subjects);
  const lines = [`# ${version} · ${date}`, ''];
  for (const kind of ['feat', 'fix', 'docs', 'other']) {
    const group = items.filter((i) => i.kind === kind);
    if (!group.length) continue;
    lines.push(
      `## ${TITLES[kind]}`,
      ...group.map((i) => `- ${i.text}${i.tasks.length ? ` (${i.tasks.join(', ')})` : ''}`),
      '',
    );
  }
  const tasks = [...new Set(items.flatMap((i) => i.tasks))].sort();
  lines.push(`Задачі: ${tasks.length ? tasks.join(', ') : '—'}`, '');
  return lines.join('\n');
}
