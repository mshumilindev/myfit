/**
 * Hygiene ratchet — the existing violations are frozen in tests/hygiene-baseline.json and
 * may only SHRINK. A new violation fails CI; fix it (use the kit, split the file, drop the
 * override) instead of adding it to the baseline. After cleaning up, lower the baseline with
 *   HYGIENE_WRITE=1 npx vitest run tests/hygiene-ratchet.guard.test.ts
 * Rules: .claude/rules/ui.md, .claude/rules/client-architecture.md.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'client', 'src');
const BASELINE_FILE = join(__dirname, 'hygiene-baseline.json');
const MAX_LINES = 600;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (f: string) => relative(SRC, f).split('\\').join('/');
const all = walk(SRC);
const isTest = (f: string) => /\.(test|stories|guard\.test)\.[tj]sx?$/.test(f);
const inKit = (f: string) => rel(f).startsWith('components/ui/');
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Kit primitive names re-declared outside components/ui (a parallel implementation). */
function duplicatePrimitives(): string[] {
  const kitDir = join(SRC, 'components', 'ui');
  const names = readdirSync(kitDir)
    .filter((n) => /^[A-Z][A-Za-z0-9]+\.tsx$/.test(n) && !/\.(test|stories)\.tsx$/.test(n))
    .map((n) => n.replace(/\.tsx$/, ''));
  const hits: string[] = [];
  for (const f of all) {
    if (!/\.tsx$/.test(f) || isTest(f) || inKit(f) || rel(f).startsWith('stories/')) continue;
    const text = strip(readFileSync(f, 'utf8'));
    for (const n of names) {
      if (new RegExp(`(?:function|const)\\s+${n}\\b\\s*[(=:<]`).test(text))
        hits.push(`${n}::${rel(f)}`);
    }
  }
  return hits.sort();
}

/** `!important` count per CSS file. */
function importantByFile(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of all) {
    if (!f.endsWith('.css')) continue;
    const n = (strip(readFileSync(f, 'utf8')).match(/!important/g) ?? []).length;
    if (n) out[rel(f)] = n;
  }
  return out;
}

/** Source files longer than MAX_LINES (split by responsibility instead). */
function oversizedFiles(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of all) {
    if (
      !/\.(tsx?|css)$/.test(f) ||
      isTest(f) ||
      rel(f).startsWith('i18n/') ||
      rel(f).startsWith('data/')
    )
      continue;
    const n = readFileSync(f, 'utf8').split('\n').length;
    if (n > MAX_LINES) out[rel(f)] = n;
  }
  return out;
}

/** Kit components must stay presentational: no data layer, router or crypto imports. */
function kitDataImports(): string[] {
  const hits: string[] = [];
  const bad =
    /from\s+['"](?:firebase\/[^'"]*|react-router[^'"]*|(?:\.\.?\/)+(?:store|api|firebase|vault[A-Za-z]*|coachCrypto[^'"]*|offline[^'"]*))['"]/;
  for (const f of all) {
    if (!/\.tsx?$/.test(f) || isTest(f) || !inKit(f)) continue;
    const text = strip(readFileSync(f, 'utf8'));
    for (const line of text.split('\n')) if (bad.test(line)) hits.push(`${rel(f)}: ${line.trim()}`);
  }
  return hits.sort();
}

/** `@ts-ignore`, `@ts-expect-error` and explicit `any` in production code. */
function typeEscapes(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of all) {
    if (!/\.tsx?$/.test(f) || isTest(f)) continue;
    const n = (
      readFileSync(f, 'utf8').match(/@ts-ignore|@ts-expect-error|:\s*any\b|\bas any\b/g) ?? []
    ).length;
    if (n) out[rel(f)] = n;
  }
  return out;
}

type Baseline = {
  duplicatePrimitives: string[];
  importantByFile: Record<string, number>;
  oversizedFiles: Record<string, number>;
  kitDataImports: string[];
  typeEscapes: Record<string, number>;
};

const current: Baseline = {
  duplicatePrimitives: duplicatePrimitives(),
  importantByFile: importantByFile(),
  oversizedFiles: oversizedFiles(),
  kitDataImports: kitDataImports(),
  typeEscapes: typeEscapes(),
};

if (process.env.HYGIENE_WRITE === '1' || !existsSync(BASELINE_FILE)) {
  writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
}
const baseline: Baseline = {
  kitDataImports: [],
  typeEscapes: {},
  ...JSON.parse(readFileSync(BASELINE_FILE, 'utf8')),
};

describe('hygiene ratchet (violations may only shrink)', () => {
  it('no new component re-declares a kit primitive outside components/ui', () => {
    const added = current.duplicatePrimitives.filter(
      (d) => !baseline.duplicatePrimitives.includes(d),
    );
    expect(added, 'use the kit primitive (or extend it) instead of a parallel copy').toEqual([]);
  });

  it('no new or increased `!important` in CSS', () => {
    const worse = Object.entries(current.importantByFile).filter(
      ([f, n]) => n > (baseline.importantByFile[f] ?? 0),
    );
    expect(worse, 'add a kit prop / variant instead of forcing the cascade').toEqual([]);
  });

  it(`no new or grown source file over ${MAX_LINES} lines`, () => {
    const worse = Object.entries(current.oversizedFiles).filter(
      ([f, n]) => n > (baseline.oversizedFiles[f] ?? 0),
    );
    expect(
      worse,
      'split the file by responsibility (hooks / pure helpers / presentational parts)',
    ).toEqual([]);
  });

  it('kit components stay presentational (no firebase / router / store / vault / offline imports)', () => {
    const added = current.kitDataImports.filter((d) => !baseline.kitDataImports.includes(d));
    expect(
      added,
      'pass data and callbacks via props; keep the data layer out of components/ui',
    ).toEqual([]);
  });

  it('no new `any` / @ts-ignore / @ts-expect-error in production code', () => {
    const worse = Object.entries(current.typeEscapes).filter(
      ([f, n]) => n > (baseline.typeEscapes[f] ?? 0),
    );
    expect(worse, 'type it properly; an escape needs a comment and an issue').toEqual([]);
  });
});
