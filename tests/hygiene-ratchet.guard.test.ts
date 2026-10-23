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
/** The public landing page is its own design (docs/adr/006-landing-outside-kit.md), not an app screen. */
const LANDING = 'views/landing/';
const all = walk(SRC).filter((f) => !relative(SRC, f).split('\\').join('/').startsWith(LANDING));
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

const isFeatureTsx = (f: string) =>
  /\.tsx$/.test(f) && !isTest(f) && !inKit(f) && !rel(f).startsWith('stories/');
const isFeatureCss = (f: string) =>
  f.endsWith('.css') &&
  !inKit(f) &&
  !/(^|\/)(styles|glass|redesign)\.css$/.test(rel(f)) &&
  !rel(f).startsWith('tokens/'); // primitives live there: raw values are its job (ADR 010)

function countByFile(files: string[], re: RegExp): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of files) {
    const n = (strip(readFileSync(f, 'utf8')).match(re) ?? []).length;
    if (n) out[rel(f)] = n;
  }
  return out;
}

/** Visual inline styles (`style={{`) in screens: use kit props, CSS variables or a class (SPO-134). */
const inlineStyles = () => countByFile(all.filter(isFeatureTsx), /style=\{\{/g);
/** Raw hex colours in screens instead of tokens (atlas/brand are illustrations with their own palette). */
const rawHexInTsx = () =>
  countByFile(
    all.filter((f) => isFeatureTsx(f) && !/atlas\/|brand\//.test(rel(f))),
    /#[0-9a-fA-F]{3,8}\b/g,
  );
/** Raw hex colours in feature CSS (token files are exempt). */
const rawHexInFeatureCss = () => countByFile(all.filter(isFeatureCss), /#[0-9a-fA-F]{3,8}\b/g);
/** "Magic" px for spacing / radius / font-size in feature CSS instead of tokens. */
const magicPxInFeatureCss = () =>
  countByFile(
    all.filter(isFeatureCss),
    /(?:padding|margin|gap|border-radius|font-size)\s*:\s*[^;{}]*\b\d+px/g,
  );

/** Kit primitives (components/ui/*.tsx) that docs/UI-KIT.md does not mention (SPO-137). */
function kitPrimitivesMissingFromDoc(): string[] {
  const doc = readFileSync(join(__dirname, '..', 'docs', 'UI-KIT.md'), 'utf8');
  const names = readdirSync(join(SRC, 'components', 'ui'))
    .filter((n) => /^[A-Z][A-Za-z0-9]+\.tsx$/.test(n) && !/\.(test|stories)\.tsx$/.test(n))
    .map((n) => n.replace(/\.tsx$/, ''));
  return names.filter((n) => !new RegExp(`\\b${n}\\b`).test(doc)).sort();
}

type Baseline = {
  duplicatePrimitives: string[];
  importantByFile: Record<string, number>;
  oversizedFiles: Record<string, number>;
  kitDataImports: string[];
  typeEscapes: Record<string, number>;
  inlineStyles: Record<string, number>;
  rawHexInTsx: Record<string, number>;
  rawHexInFeatureCss: Record<string, number>;
  magicPxInFeatureCss: Record<string, number>;
  kitPrimitivesMissingFromDoc: string[];
};

const current: Baseline = {
  duplicatePrimitives: duplicatePrimitives(),
  importantByFile: importantByFile(),
  oversizedFiles: oversizedFiles(),
  kitDataImports: kitDataImports(),
  typeEscapes: typeEscapes(),
  inlineStyles: inlineStyles(),
  rawHexInTsx: rawHexInTsx(),
  rawHexInFeatureCss: rawHexInFeatureCss(),
  magicPxInFeatureCss: magicPxInFeatureCss(),
  kitPrimitivesMissingFromDoc: kitPrimitivesMissingFromDoc(),
};

if (process.env.HYGIENE_WRITE === '1' || !existsSync(BASELINE_FILE)) {
  writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
}
const baseline: Baseline = {
  kitDataImports: [],
  typeEscapes: {},
  inlineStyles: {},
  rawHexInTsx: {},
  rawHexInFeatureCss: {},
  magicPxInFeatureCss: {},
  kitPrimitivesMissingFromDoc: [],
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

  it('no new or increased visual inline `style={{}}` in screens', () => {
    const worse = Object.entries(current.inlineStyles).filter(
      ([f, n]) => n > (baseline.inlineStyles[f] ?? 0),
    );
    expect(
      worse,
      'use a kit prop, a CSS variable or a class; add a kit variant if missing',
    ).toEqual([]);
  });

  it('no new or increased raw hex colours in screens or feature CSS', () => {
    const worse = [
      ...Object.entries(current.rawHexInTsx).filter(([f, n]) => n > (baseline.rawHexInTsx[f] ?? 0)),
      ...Object.entries(current.rawHexInFeatureCss).filter(
        ([f, n]) => n > (baseline.rawHexInFeatureCss[f] ?? 0),
      ),
    ];
    expect(worse, 'use a semantic token (var(--…)) instead of a literal colour').toEqual([]);
  });

  it('no new or increased magic px for spacing / radius / font-size in feature CSS', () => {
    const worse = Object.entries(current.magicPxInFeatureCss).filter(
      ([f, n]) => n > (baseline.magicPxInFeatureCss[f] ?? 0),
    );
    expect(worse, 'use the spacing / radius / type tokens (8-pt scale)').toEqual([]);
  });

  it('every kit primitive is documented in docs/UI-KIT.md', () => {
    const added = current.kitPrimitivesMissingFromDoc.filter(
      (n) => !baseline.kitPrimitivesMissingFromDoc.includes(n),
    );
    expect(added, 'add purpose / props / when-not-to-use for it to docs/UI-KIT.md').toEqual([]);
  });
});
