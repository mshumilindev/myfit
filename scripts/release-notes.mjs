#!/usr/bin/env node
// Usage: node scripts/release-notes.mjs <version> [from-ref] [to-ref]  → markdown on stdout.
// Notes are only drafted; the tag/release itself still needs the owner's word (.claude/rules/releases.md).
import { execFileSync } from 'node:child_process';
import { renderNotes } from './lib/release-notes.mjs';

const [version = 'unreleased', from, to = 'HEAD'] = process.argv.slice(2);
const range = from ? `${from}..${to}` : to;
const out = execFileSync('git', ['log', '--format=%s', range, '--', '.'], {
  encoding: 'utf8',
  maxBuffer: 1 << 26,
});
process.stdout.write(
  renderNotes({ version, date: new Date().toISOString().slice(0, 10), subjects: out.split('\n') }),
);
