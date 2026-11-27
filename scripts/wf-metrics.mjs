#!/usr/bin/env node
/** SPO-639 (WF-H): print flow metrics from .claude/state/wf-events.jsonl as markdown for the weekly review. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, summarize } from './lib/wf-metrics.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(process.env.WF_STATE_DIR ?? join(ROOT, '.claude/state'), 'wf-events.jsonl');
if (!existsSync(file)) {
  console.error('wf-metrics: немає журналу подій');
  process.exit(2);
}
const entries = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
console.log(renderMarkdown(summarize(entries)));
