/**
 * Static asset guard (SPO-358 / SPO-359): every picture the app points at by a literal public path (TS/TSX,
 * CSS `url()`, JSON data such as the exercise catalog, index.html) must exist in `client/public`, i.e. in the
 * build. Firebase Hosting rewrites `**` to index.html, so a missing file is not a 404 but an HTML page with
 * status 200: the <img> just paints nothing and the card is an empty box. This fails in CI instead.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT = join(__dirname, '..', 'client');
const SRC = join(CLIENT, 'src');
const PUBLIC = join(CLIENT, 'public');

const DIRS = [
  'markers',
  'exercise-img',
  'equipment',
  'gyms',
  'atlas',
  'backgrounds',
  'anatomy',
  'physiques',
  'landing',
  'brand',
  'icons',
  'favicon',
];
const EXT = '(?:jpe?g|png|webp|svg|gif|avif|ico)';
/** '/markers/x.jpg' | "/x.webp" | url(/x.png) | url('/x.png') — literal only (no `${}` templates). */
const REF = new RegExp(
  `(?:['"\`(])(\\/(?:(?:${DIRS.join('|')})\\/[^'"\`)\\s$\\\\]+|[\\w.-]+)\\.${EXT})(?=['"\`)?#\\s])`,
  'g',
);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|json)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every literal public reference with the file that holds it. */
function publicRefs(files: string[]): Map<string, string> {
  const refs = new Map<string, string>();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(REF)) if (!refs.has(m[1]!)) refs.set(m[1]!, f);
  }
  return refs;
}

describe('static assets resolve in the build', () => {
  const refs = publicRefs([...walk(SRC), join(CLIENT, 'index.html')]);

  it('finds the references it is meant to guard (the scan itself is not empty)', () => {
    expect(refs.has('/markers/warmup.jpg')).toBe(true);
    expect(refs.has('/markers/cooldown.jpg')).toBe(true);
    expect([...refs.keys()].some((r) => r.startsWith('/exercise-img/'))).toBe(true);
    expect(refs.size).toBeGreaterThan(100);
  });

  it('every literal /public path points at a real, non-empty file', () => {
    const missing = [...refs]
      .filter(([r]) => {
        const p = join(PUBLIC, r);
        return !existsSync(p) || statSync(p).size === 0;
      })
      .map(([r, f]) => `${r}  (in ${relative(CLIENT, f)})`);
    expect(missing).toEqual([]);
  });

  it('the warm-up and cool-down start-card photos are real JPEGs (not an HTML fallback saved as .jpg)', () => {
    for (const n of ['warmup', 'cooldown']) {
      const head = readFileSync(join(PUBLIC, 'markers', `${n}.jpg`)).subarray(0, 3);
      expect([...head]).toEqual([0xff, 0xd8, 0xff]);
    }
  });

  it('detects a missing asset (the scan is able to fail)', () => {
    const found = [...'const a = "/markers/gone-forever.jpg";'.matchAll(REF)].map((m) => m[1]);
    expect(found).toEqual(['/markers/gone-forever.jpg']);
    expect(existsSync(join(PUBLIC, found[0]!))).toBe(false);
  });
});
