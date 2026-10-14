/**
 * Architecture guard of the program editor tool (like `components/ui/kit.test.ts` for the kit).
 * The runtime of the tool (everything except tests and stories) may import ONLY:
 *   1. files of its own folder,
 *   2. the UI kit (`components/ui/**`) and the shared icon (`ui`),
 *   3. npm packages `react` and `react/jsx-runtime`.
 * Never the host: not `coach/**`, `views/**`, `data/**`, `i18n/**`, `store`, `api`, `firebase`... A host feeds the tool
 * through `ProgramEditorHost` (see host.ts). Stories and tests may import a dictionary or a catalog to build a demo host.
 */
import { describe, expect, it } from 'vitest';

const raw = (m: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(m).map(([k, v]) => [k.replace(/^\.\//, ''), String(v)] as const),
  );

const SRC = raw(
  import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);
const CSS = raw(import.meta.glob('./**/*.css', { query: '?raw', import: 'default', eager: true }));

const isRuntime = (f: string) => !f.endsWith('.stories.tsx') && !f.startsWith('stories/');
const runtime = Object.keys(SRC).filter(isRuntime);

const importsOf = (code: string): string[] =>
  [...code.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;'"]*?from\s+['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  );

/** Resolve a relative specifier against the importing file; both are paths below `src/tools/programEditor`. */
function resolve(from: string, spec: string): string {
  const parts = ['tools', 'programEditor', ...from.split('/').slice(0, -1)];
  for (const seg of spec.split('/')) {
    if (seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

const ALLOWED_PACKAGES = new Set(['react', 'react/jsx-runtime']);

describe('program editor tool: architecture', () => {
  it('finds the runtime files', () => {
    expect(runtime.length).toBeGreaterThan(10);
  });

  it.each(runtime)('%s imports only its own folder, the UI kit and react', (file) => {
    for (const spec of importsOf(SRC[file])) {
      if (!spec.startsWith('.')) {
        expect(ALLOWED_PACKAGES.has(spec), `${file}: package "${spec}" is not allowed`).toBe(true);
        continue;
      }
      const target = resolve(file, spec);
      const own = target.startsWith('tools/programEditor');
      const kit = target.startsWith('components/ui/') || target === 'ui';
      expect(
        own || kit,
        `${file}: "${spec}" reaches outside the tool (${target}). Feed it through ProgramEditorHost instead.`,
      ).toBe(true);
    }
  });

  it('the host contract does not import UI code that could pull a host in', () => {
    expect(importsOf(SRC['host.ts']).every((s) => s.startsWith('.') || s === 'react')).toBe(true);
  });

  it.each(Object.keys(CSS))('%s is layout only: tokens, no raw colours or lengths', (file) => {
    const css = CSS[file].replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    // Lengths come from tokens; a px literal is allowed only inside @media conditions.
    const withoutMedia = css.replace(/@media[^{]*\{/g, '{');
    expect(withoutMedia).not.toMatch(/[^-\w]\d+(?:\.\d+)?px\b/);
  });

  it('no raw <button> or <input> in the tool: the kit owns the controls', () => {
    for (const f of runtime.filter((x) => x.endsWith('.tsx')))
      expect(SRC[f], f).not.toMatch(/<(button|input|select|textarea)[\s>]/);
  });

  it('no keyboard shortcuts (the product has none)', () => {
    for (const f of runtime)
      expect(SRC[f], f).not.toMatch(/\b(?:onKeyDown|onKeyUp|addEventListener\(\s*['"]key)/);
  });
});
