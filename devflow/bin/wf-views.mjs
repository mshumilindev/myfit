#!/usr/bin/env node
/** SPO-639 W7: node scripts/wf-views.mjs card|approvals|digest — markdown for Linear comments and the morning digest. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isValidState } from '../core/wf-core.mjs';
import { renderApprovals, renderCard, renderDigest } from '../core/wf-views.mjs';

const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const file = join(process.env.WF_STATE_DIR ?? join(root, '.claude/state'), 'wf.json');
const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
if (!state || !isValidState(state) || !state.task) {
  console.error('wf-views: немає активної задачі');
  process.exit(2);
}
const mode = process.argv[2] ?? 'card';
if (mode === 'approvals') console.log(renderApprovals(state));
else if (mode === 'digest') {
  const dir = join(root, 'docs/reviews/metrics');
  const latest = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.startsWith('ci-'))
        .sort()
        .at(-1)
    : null;
  console.log(
    renderDigest(state, latest ? JSON.parse(readFileSync(join(dir, latest), 'utf8')) : null),
  );
} else console.log(renderCard(state));
