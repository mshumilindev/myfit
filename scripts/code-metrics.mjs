#!/usr/bin/env node
/**
 * Code conformity metrics for SPO-125 (rules audit). Re-run to get the "after" numbers:
 *   node scripts/code-metrics.mjs [--json]
 * Measures how far client/src is from .claude/rules/ui.md and client-architecture.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'client', 'src');
const walk = (d, o = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, o);
    else o.push(p);
  }
  return o;
};
const rel = (f) => relative(SRC, f).split('\\').join('/');
const all = walk(SRC);
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const isTest = (f) => /\.(test|stories)\.[tj]sx?$/.test(f);
const inKit = (f) => rel(f).startsWith('components/ui/');
const read = (f) => readFileSync(f, 'utf8');

const tsx = all.filter((f) => /\.tsx$/.test(f) && !isTest(f) && !rel(f).startsWith('stories/'));
const feature = tsx.filter((f) => !inKit(f));
const css = all.filter((f) => f.endsWith('.css'));
const featureCss = css.filter(
  (f) => !inKit(f) && !/(^|\/)(styles|glass|redesign)\.css$/.test(rel(f)),
);

// A file imports the kit when any import specifier RESOLVES into components/ui (so `./ui/Card` inside
// components/ counts, not only the `components/ui` spelling).
const importsKit = (f) => {
  const dir = join(f, '..');
  for (const m of read(f).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const target = rel(join(dir, spec)).replace(/\/+$/, '');
    if (target === 'components/ui' || target.startsWith('components/ui/')) return true;
  }
  return false;
};
const kitImporters = feature.filter(importsKit);
// A screen is a file that draws its own markup (an intrinsic JSX element). A pure switch / wrapper that only
// returns other components (AlcoholScreens, SelfProgramEditor …) has nothing to put on the kit itself.
const drawsMarkup = (f) => /<[a-z][a-zA-Z0-9]*[\s>/]/.test(strip(read(f)));
const screens = feature.filter(
  (f) =>
    (/(views|screens|pages|routes)\//i.test(rel(f)) || /(View|Page|Screen)\.tsx$/.test(f)) &&
    drawsMarkup(f),
);
const screensOnKit = screens.filter((f) => kitImporters.includes(f));
const count = (re, files) => files.reduce((n, f) => n + (strip(read(f)).match(re) ?? []).length, 0);

const m = {
  tsxFeatureFiles: feature.length,
  featureFilesImportingKit: kitImporters.length,
  featureFilesImportingKitPct: +((100 * kitImporters.length) / feature.length).toFixed(1),
  screenFiles: screens.length,
  screensImportingKit: screensOnKit.length,
  screensImportingKitPct: +((100 * screensOnKit.length) / screens.length).toFixed(1),
  screensWithoutKit: screens.filter((f) => !kitImporters.includes(f)).map(rel),
  importantTotal: count(/!important/g, css),
  importantOutsideKit: count(
    /!important/g,
    css.filter((f) => !inKit(f)),
  ),
  inlineStyleObjects: count(/style=\{\{/g, feature),
  rawHexInTsx: count(
    /#[0-9a-fA-F]{3,8}\b/g,
    feature.filter((f) => !/atlas\/|brand\//.test(rel(f))),
  ),
  rawHexInFeatureCss: count(/#[0-9a-fA-F]{3,8}\b/g, featureCss),
  magicPxInFeatureCss: count(
    /(?:padding|margin|gap|border-radius|font-size)\s*:\s*[^;{}]*\b\d+px/g,
    featureCss,
  ),
  featureCssFiles: featureCss.length,
  tsIgnoreOrAny: count(
    /@ts-ignore|@ts-expect-error|:\s*any\b|\bas any\b/g,
    all.filter((f) => /\.tsx?$/.test(f) && !isTest(f)),
  ),
  filesOver600Lines: all.filter(
    (f) =>
      /\.(tsx?|css)$/.test(f) &&
      !isTest(f) &&
      !/^(i18n|data)\//.test(rel(f)) &&
      read(f).split('\n').length > 600,
  ).length,
  kitPrimitivesInUiKitDoc: null,
};
try {
  const doc = readFileSync(join(process.cwd(), 'docs', 'UI-KIT.md'), 'utf8');
  const prims = readdirSync(join(SRC, 'components', 'ui'))
    .filter((n) => /^[A-Z][A-Za-z0-9]+\.tsx$/.test(n) && !isTest(n))
    .map((n) => n.replace('.tsx', ''));
  const missing = prims.filter((p) => !new RegExp(`\\b${p}\\b`).test(doc));
  const noTest = prims.filter(
    (p) =>
      !all.some(
        (f) => rel(f) === `components/ui/${p}.test.tsx` || rel(f) === `components/ui/${p}.test.ts`,
      ),
  );
  m.kitPrimitives = prims.length;
  m.kitPrimitivesInUiKitDoc = prims.length - missing.length;
  m.kitPrimitivesMissingFromDoc = missing;
  m.kitPrimitivesWithoutOwnTest = noTest.length;
} catch {
  // docs/UI-KIT.md missing: kit doc metrics stay null
}

if (process.argv.includes('--json')) console.log(JSON.stringify(m, null, 2));
else
  for (const [k, v] of Object.entries(m))
    console.log(
      `${k}: ${Array.isArray(v) ? `${v.length} (${v.slice(0, 12).join(', ')}${v.length > 12 ? ', …' : ''})` : v}`,
    );
