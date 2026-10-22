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
// Brand names, units and loanwords that are the same word in the other languages (not forgotten translations).
const allowedIdentical = new Set([
  'appName',
  'menuAction',
  'adminQr',
  'min',
  'kg',
  'bmBmi',
  'themeBrassName',
  'atlasName',
  'apexName',
  'playbook',
  'prE1',
  'speedCol',
  'rcKcal',
  'setSDShort',
  'chMinShort',
  'rcMinShort',
  'sbMinShort',
  'sleepAutoBadge',
  'sbAutoPick',
  'restAuto',
  'amenAuto',
  'alcRegionAuto',
  'progDeload',
  'amen_sauna',
  'amen_jacuzzi',
  'alcPint',
  'todayAtlasOnline',
  'landing_ai_off',
  'injStepPlan',
  'injBannerCheckin',
  'timerStart',
  'pickStart',
  'homeStart',
  'esCircuitStart',
  'chStart',
  'atlasPlanStart',
  'actStart',
]);
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
const visibleRe = /(?<![=-])>\s*([^<>{}\n]*[A-Za-zА-Яа-яІіЇїЄєҐґ][^<>{}\n]*)\s*</g;
// Units and symbols that read the same in every language.
const allowVisible = new Set([
  't',
  'spotter',
  'kg',
  'km',
  'kcal',
  'reps',
  'h',
  'k',
  's',
  'z',
  'x',
  'y',
  'n',
  'i',
  'o',
  'u',
  'F',
  'PR',
  'MEV–MRV',
  '&lt;5',
]);
const codeLikeVisibleRe =
  /[=()?:.]|&&|\|\||\bPromise\b|\bMath\b|\bGET\b|\bPOST\b|\bPUT\b|\bDELETE\b/;
// Storybook stories and their fixtures are a dev-only catalog (never shipped):
// demo copy there is not UI text. Product components are still checked.
// The dev-only UI-kit gallery (import.meta.env.DEV) and the generated, owner-approved landing template (its copy goes
// through T(); the leftovers are brand/OS names and phone-mockup art, tracked in SPO-168/169) are not scanned.
const ignoredFileNames = new Set(['Gallery.tsx', 'LandingDesign.tsx']);
const ignoredDirs = new Set(['i18n', 'data', 'stories', '__fixtures__']);
// Tests and their fixtures are never shipped either.
const ignoredFileRe =
  /\.(stories|test|cases\.test)\.tsx?$|\.test\.tsx?$|(^|[\\/])(testWorld|testVault)\.tsx?$/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) out.push(...walk(path.join(dir, entry.name)));
      continue;
    }
    if (
      /\.(tsx|ts)$/.test(entry.name) &&
      !ignoredFileRe.test(entry.name) &&
      !ignoredFileNames.has(entry.name)
    )
      out.push(path.join(dir, entry.name));
  }
  return out;
}

// Comments are not UI, and `<Type>` generics in plain .ts files are not JSX: only .tsx has visible text.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

for (const file of walk(sourceDir)) {
  const rel = path.relative(root, file);
  const text = stripComments(read(file));
  let match;
  while ((match = attrRe.exec(text))) {
    if (/^(Spotter|0 t)$/.test(match[2])) continue; // brand and a unit
    failures.push(`${rel}: hardcoded ${match[1]}="${match[2]}"`);
  }
  while (file.endsWith('.tsx') && (match = visibleRe.exec(text))) {
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
