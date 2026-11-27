#!/usr/bin/env node
// Quick capture: node scripts/idea.mjs "text" → one line appended to docs/ideas.md (no triage, no task created).
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { formatIdea } from './lib/idea.mjs';

const text = process.argv.slice(2).join(' ').trim();
if (!text) {
  console.error('usage: node scripts/idea.mjs "text"');
  process.exit(2);
}
const file = process.env.IDEAS_FILE ?? 'docs/ideas.md';
if (!existsSync(file))
  writeFileSync(
    file,
    '# Ідеї (швидке захоплення)\n\nРозбір — під час тріажу; задачу тут не створюємо.\n\n',
  );
appendFileSync(file, formatIdea(text));
console.log(`idea: збережено в ${file}`);
