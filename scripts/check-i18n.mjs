import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const localeDir = path.join(root, 'client', 'src', 'i18n');
const localeFiles = ['en.ts', 'uk.ts', 'pl.ts', 'lt.ts', 'et.ts'];
const sourceDir = path.join(root, 'client', 'src');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function topLevelKeys(text) {
  const bodyStart = text.indexOf('{', text.indexOf('export const'));
  const bodyEnd = text.lastIndexOf('};');
  const body = text.slice(bodyStart + 1, bodyEnd);
  const keys = [];
  let depth = 0;
  let depthAtLineStart = 0;
  let quote = null;
  let escape = false;
  let lineStart = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (ch === '\n') {
      const line = body.slice(lineStart, i);
      // A key belongs to the depth its line STARTS on, so a multi-line value
      // (array/object) counts the same as its single-line formatting.
      if (depthAtLineStart === 0) {
        const match = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/.exec(line);
        if (match) keys.push(match[1]);
      }
      depthAtLineStart = depth;
      lineStart = i + 1;
    }
  }
  return keys;
}

function staticStringValues(text) {
  const values = new Map();
  const bodyStart = text.indexOf('{', text.indexOf('export const'));
  const bodyEnd = text.lastIndexOf('};');
  const body = text.slice(bodyStart + 1, bodyEnd);
  let depth = 0;
  let quote = null;
  let escape = false;
  let lineStart = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    if (ch === '\n') {
      const line = body.slice(lineStart, i);
      if (depth === 0) {
        const match = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*(['"`])([^'"`$]*)\2\s*,?\s*$/.exec(line);
        if (match) values.set(match[1], match[3]);
      }
      lineStart = i + 1;
    }
  }
  return values;
}

const baseKeys = topLevelKeys(read(path.join(localeDir, 'en.ts')));
const baseStaticValues = staticStringValues(read(path.join(localeDir, 'en.ts')));
const failures = [];
const allowedIdentical = new Set(['appName', 'menuAction', 'adminQr', 'min', 'kg']);
for (const file of localeFiles.slice(1)) {
  const text = read(path.join(localeDir, file));
  const keys = topLevelKeys(text);
  const missing = baseKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !baseKeys.includes(k));
  if (missing.length) failures.push(`${file}: missing keys ${missing.join(', ')}`);
  if (extra.length) failures.push(`${file}: extra keys ${extra.join(', ')}`);

  const staticValues = staticStringValues(text);
  for (const [key, value] of staticValues.entries()) {
    if (allowedIdentical.has(key) || !baseStaticValues.has(key)) continue;
    if (value.length > 2 && /[A-Za-z]/.test(value) && value === baseStaticValues.get(key)) {
      failures.push(`${file}: untranslated static key ${key}="${value}"`);
    }
  }
}

const textRe = /[A-Za-zА-Яа-яІіЇїЄєҐґ]/;
const attrRe = /\b(aria-label|placeholder|title)="([^"{]*[A-Za-zА-Яа-яІіЇїЄєҐґ][^"{]*)"/g;
const visibleRe = />\s*([^<>{}\n]*[A-Za-zА-Яа-яІіЇїЄєҐґ][^<>{}\n]*)\s*</g;
const allowVisible = new Set(['t']);
const codeLikeVisibleRe =
  /[=()?:.]|&&|\|\||\bPromise\b|\bMath\b|\bGET\b|\bPOST\b|\bPUT\b|\bDELETE\b/;
const ignoredDirs = new Set(['i18n', 'data']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) out.push(...walk(path.join(dir, entry.name)));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name)) out.push(path.join(dir, entry.name));
  }
  return out;
}

for (const file of walk(sourceDir)) {
  const rel = path.relative(root, file);
  const text = read(file);
  let match;
  while ((match = attrRe.exec(text))) {
    failures.push(`${rel}: hardcoded ${match[1]}="${match[2]}"`);
  }
  while ((match = visibleRe.exec(text))) {
    const value = match[1].trim();
    if (value && textRe.test(value) && !allowVisible.has(value) && !codeLikeVisibleRe.test(value)) {
      failures.push(`${rel}: hardcoded visible text "${value}"`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`i18n: ${baseKeys.length} keys checked across ${localeFiles.length} locales`);
