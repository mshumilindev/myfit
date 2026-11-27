/**
 * SPO-639 (WF-H): flow metrics from the wf journal (ids, categories and time only — no text, no PII).
 * Pure: entries in, summary out; scripts/wf-metrics.mjs reads the file and prints markdown.
 */
export function summarize(entries) {
  const byItem = new Map();
  const blocks = {};
  let starts = 0;
  let heartbeats = 0;
  for (const e of entries) {
    if (e.type === 'start') starts += 1;
    if (e.type === 'heartbeat') heartbeats += 1;
    if (e.type === 'block') blocks[e.needs] = (blocks[e.needs] ?? 0) + 1;
    if (!e.item) continue;
    const rec = byItem.get(e.item) ?? {};
    if (e.type === 'add') rec.added = e.ts;
    if (e.type === 'doing' && rec.doing === undefined) rec.doing = e.ts;
    if (e.type === 'done') rec.done = e.ts;
    byItem.set(e.item, rec);
  }
  const lead = [];
  const cycle = [];
  for (const rec of byItem.values()) {
    if (rec.added !== undefined && rec.done !== undefined) lead.push(rec.done - rec.added);
    if (rec.doing !== undefined && rec.done !== undefined) cycle.push(rec.done - rec.doing);
  }
  const median = (xs) => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };
  return {
    tasks: starts,
    items: byItem.size,
    done: [...byItem.values()].filter((r) => r.done !== undefined).length,
    leadMedianMs: median(lead),
    cycleMedianMs: median(cycle),
    blocks,
    heartbeats,
  };
}

const fmt = (ms) => {
  if (ms === null) return '—';
  const min = Math.round(ms / 60000);
  return min < 90 ? `${min} хв` : `${(min / 60).toFixed(1)} год`;
};

export function renderMarkdown(s) {
  const blocked =
    Object.entries(s.blocks)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') || '—';
  return [
    '| Показник | Значення |',
    '| --- | --- |',
    `| Задач (start) | ${s.tasks} |`,
    `| Пунктів / закрито | ${s.items} / ${s.done} |`,
    `| Lead time (медіана add→done) | ${fmt(s.leadMedianMs)} |`,
    `| Cycle time (медіана doing→done) | ${fmt(s.cycleMedianMs)} |`,
    `| Блокери за категоріями | ${blocked} |`,
    `| Heartbeat без прогресу (всього) | ${s.heartbeats} |`,
  ].join('\n');
}
