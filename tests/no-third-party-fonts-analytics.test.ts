import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SPO-287 (gap G8 of SPO-252): no font host and no analytics on every visit. Fonts are self-hosted
 * (@fontsource, ADR 007); Firebase Analytics is not initialised. Static checks only.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const FONT_HOST = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net/;

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

describe('no third-party font host or analytics (SPO-287)', () => {
  it('index.html references no external font host and no preconnect to one', () => {
    const html = read('client/index.html');
    expect(html).not.toMatch(FONT_HOST);
    expect(html).not.toMatch(/rel="preconnect"\s+href="https?:/);
  });

  it('no source stylesheet or script reaches a font host', () => {
    const files = walk(resolve(root, 'client/src'), /\.(css|tsx?)$/).filter(
      (f) => !/\.test\.tsx?$/.test(f),
    );
    const bad = files.filter((f) => FONT_HOST.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('the built CSS in client/dist (when present) loads no external url()/@import', () => {
    const dist = resolve(root, 'client/dist/assets');
    if (!existsSync(dist)) return;
    for (const f of walk(dist, /\.css$/)) {
      const css = readFileSync(f, 'utf8');
      expect(css, f).not.toMatch(FONT_HOST);
      expect(css, f).not.toMatch(/@import\s*(url\()?["']?https?:/);
    }
  });

  it('every @font-face is display: swap, in our CSS and in the @fontsource files we import', () => {
    const faceBlocks = (css: string) => css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    for (const f of walk(resolve(root, 'client/src'), /\.css$/)) {
      for (const b of faceBlocks(readFileSync(f, 'utf8')))
        expect(b, f).toMatch(/font-display:\s*swap/);
    }
    const imported = new Set<string>();
    for (const f of walk(resolve(root, 'client/src'), /\.tsx?$/)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/import\s+'(@fontsource\/[^']+\.css)'/g))
        imported.add(m[1]);
    }
    expect(imported.size).toBeGreaterThan(0);
    for (const spec of imported) {
      const file = resolve(root, 'node_modules', spec);
      const blocks = faceBlocks(readFileSync(file, 'utf8'));
      expect(blocks.length, spec).toBeGreaterThan(0);
      for (const b of blocks) expect(b, spec).toMatch(/font-display:\s*swap/);
    }
  });

  it('the families used by the wordmark and the landing are imported (not left to a CDN)', () => {
    const main = read('client/src/main.tsx');
    expect(main).toContain('@fontsource/kaushan-script/latin-400.css');
    expect(main).toContain('@fontsource/kaushan-script/latin-ext-400.css');
    const landing = read('client/src/views/landing/LandingDesign.tsx');
    for (const fam of ['inter-tight', 'manrope', 'jetbrains-mono']) {
      for (const sub of ['latin', 'latin-ext', 'cyrillic']) {
        expect(landing, `${fam} ${sub}`).toContain(`@fontsource/${fam}/${sub}-`);
      }
    }
  });

  it('Firebase Analytics is not imported or initialised, and the config has no measurementId', () => {
    const files = walk(resolve(root, 'client/src'), /\.tsx?$/).filter(
      (f) => !/\.test\.tsx?$/.test(f),
    );
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/firebase\/analytics|getAnalytics|logEvent\(|initializeAnalytics/);
    }
    expect(read('client/src/firebase.ts')).not.toMatch(/measurementId/);
  });
});
