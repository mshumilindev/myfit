#!/usr/bin/env node
/**
 * SPO-639: the chat twin of the Dev Console chapter bar. Reads .claude/state/wf.json and prints one line per section
 * (items grouped by id prefix: A.1, A.2 -> A) with a fill bar, counts and the open items, plus a total line.
 * Read-only; paste the output into the progress status (progress-reporting.md).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const file = join(process.cwd(), '.claude/state/wf.json');
let wf;
try {
  wf = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  console.log('wf: no state on this machine');
  process.exit(0);
}
const groups = new Map();
for (const it of wf.items ?? []) {
  const key = String(it.id).split('.')[0];
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(it);
}
const W = 10;
const bar = (done, total) => {
  const n = Math.round((done / Math.max(1, total)) * W);
  return '▰'.repeat(n) + '▱'.repeat(W - n);
};
let done = 0;
let total = 0;
for (const [key, items] of groups) {
  const d = items.filter((i) => i.status === 'done').length;
  done += d;
  total += items.length;
  const open = items
    .filter((i) => i.status !== 'done')
    .map((i) =>
      `${i.status === 'doing' ? '▶' : i.status === 'blocked' ? '■' : '○'} ${i.id} ${i.text}`.slice(
        0,
        60,
      ),
    );
  console.log(
    `${key.padEnd(4)} ${bar(d, items.length)} ${d}/${items.length}${open.length ? '  ' + open.join(' | ') : ''}`,
  );
}
console.log(
  `${wf.task?.id ?? '?'} ${bar(done, total)} ${Math.round((done / Math.max(1, total)) * 100)}% (${done}/${total})`,
);
