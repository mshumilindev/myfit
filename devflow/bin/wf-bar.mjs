#!/usr/bin/env node
/**
 * SPO-639: the chat twin of the Dev Console chapter bar, colour-coded. Reads .claude/state/wf.json.
 *   node scripts/wf-bar.mjs          one line per section (one square per item), then the whole-task bar
 *   node scripts/wf-bar.mjs --last   only the whole-task bar: the line that closes EVERY message (progress-reporting.md)
 * Squares: 🟩 done · 🟦 in work · 🟥 blocked · ⬜ to do. The whole-task bar is always scaled to the real total.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const file = join(process.env.WF_STATE_DIR ?? join(process.cwd(), '.claude/state'), 'wf.json');
let wf;
try {
  wf = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  console.log('wf: no state on this machine');
  process.exit(0);
}
const SQ = { done: '🟩', doing: '🟦', blocked: '🟥', todo: '⬜' };
const ORDER = ['done', 'doing', 'blocked', 'todo'];
const items = wf.items ?? [];
const count = (list) =>
  Object.fromEntries(ORDER.map((s) => [s, list.filter((i) => i.status === s).length]));

/** `slots` squares for `list`, filled by status in ORDER, so every colour keeps at least one square when it exists. */
function squares(list, slots) {
  const c = count(list);
  const total = Math.max(1, list.length);
  const n = Object.fromEntries(
    ORDER.map((s) => [s, c[s] ? Math.max(1, Math.round((c[s] / total) * slots)) : 0]),
  );
  let sum = ORDER.reduce((a, s) => a + n[s], 0);
  while (sum > slots) {
    const big = ORDER.filter((s) => n[s] > 1).sort((a, b) => n[b] - n[a])[0];
    if (!big) break;
    n[big]--;
    sum--;
  }
  while (sum < slots) {
    const big = ORDER.filter((s) => c[s]).sort((a, b) => c[b] - c[a])[0] ?? 'todo';
    n[big]++;
    sum++;
  }
  return ORDER.map((s) => SQ[s].repeat(n[s])).join('');
}

const current = items.find((i) => i.status === 'doing');
const pct = Math.round(
  (items.filter((i) => i.status === 'done').length / Math.max(1, items.length)) * 100,
);
const done = items.filter((i) => i.status === 'done').length;
const total =
  `${wf.task?.id ?? '?'} ${squares(items, 20)} ${pct}% · ${done}/${items.length}` +
  (current ? ` · ▶ ${current.id} ${String(current.text).slice(0, 40)}` : '');

if (!process.argv.includes('--last')) {
  const groups = new Map();
  for (const it of items) {
    const key = String(it.id).split('.')[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  let closed = 0;
  for (const [key, list] of groups) {
    const c = count(list);
    if (c.done === list.length) {
      closed++;
      continue;
    }
    console.log(
      `${key.padEnd(4)} ${squares(list, Math.min(list.length, 10))} ${c.done}/${list.length}`,
    );
  }
  if (closed) console.log(`✅ ${closed} sections fully done`);
}
console.log(total);
