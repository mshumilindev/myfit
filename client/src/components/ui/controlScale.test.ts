/**
 * Control-height scale (styles.css --ctl-h-*): ONE height per size for every interactive kit control.
 * Plain unit checks, no browser: the tokens resolve to pixel values, the steps are ordered, every kit control
 * reads its height from the scale, and every size class has a scope that sets the --ctl-* variables.
 */
import { describe, expect, it } from 'vitest';
import { kitCss, stylesCss } from './readCss';

const css = stylesCss();
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** Resolve a custom property from the :root block(s) to px, following var() chains. */
function px(name: string, seen = new Set<string>()): number {
  if (seen.has(name)) throw new Error(`cycle at ${name}`);
  seen.add(name);
  const m = new RegExp(`(?:^|[\\s;{])${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`).exec(
    noComments(css),
  );
  if (!m) throw new Error(`${name} is not defined in styles.css`);
  const v = m[1].trim();
  const lit = /^(-?[\d.]+)px$/.exec(v);
  if (lit) return Number(lit[1]);
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) return px(ref[1], seen);
  throw new Error(`${name}: cannot resolve "${v}"`);
}

const SIZES = ['xs', 'sm', 'md', 'lg'] as const;

describe('control scale tokens', () => {
  it('every --ctl-* token of every size resolves to a pixel value', () => {
    for (const sz of SIZES)
      for (const k of ['h', 'px', 'gap', 'fs', 'icon'])
        expect(px(`--ctl-${k}-${sz}`), `--ctl-${k}-${sz}`).toBeGreaterThan(0);
  });
  it('heights ascend xs < sm < md < lg and md is a 44px touch target', () => {
    const h = SIZES.map((s) => px(`--ctl-h-${s}`));
    expect([...h].sort((a, b) => a - b)).toEqual(h);
    expect(new Set(h).size).toBe(4);
    expect(px('--ctl-h-md')).toBeGreaterThanOrEqual(44);
  });
  it('the legacy switch tokens are aliases of the scale, not second scales', () => {
    expect(px('--seg-h-md')).toBe(px('--ctl-h-md'));
    expect(px('--seg-h-sm')).toBe(px('--ctl-h-sm'));
    expect(px('--chip-h')).toBe(px('--ctl-h-sm'));
    expect(px('--chip-h-sm')).toBe(px('--ctl-h-xs'));
    expect(px('--tab-h')).toBe(px('--ctl-h-md'));
  });
});

describe('control scale scopes', () => {
  const sheet = noComments(css);
  it.each(['uibtn', 'uiseg', 'uifield', 'uisearch', 'stab', 'uichip', 'uipc', 'uiback'])(
    '.%s has a default scope and a scope per size, and rows can force one',
    (cls) => {
      expect(sheet).toMatch(new RegExp(`\\.${cls}[,\\s{]`));
      for (const sz of SIZES) {
        const scope = new RegExp(
          `\\.${cls}--${sz}\\b[^{]*\\{[^}]*--ctl-h:\\s*var\\(--ctl-h-${sz}\\)`,
        );
        expect(scope.test(sheet), `.${cls}--${sz}`).toBe(true);
      }
    },
  );
  it.each(SIZES)('.ctl-row--%s forces the whole control family to that step', (sz) => {
    const m = new RegExp(
      `\\.ctl-row--${sz} :is\\(([^)]*)\\)\\s*\\{[^}]*--ctl-h:\\s*var\\(--ctl-h-${sz}\\)`,
    ).exec(sheet);
    expect(m, `.ctl-row--${sz}`).not.toBeNull();
    for (const c of ['.uibtn', '.uiseg', '.uifield', '.uisearch', '.stab', '.uichip', '.uipc'])
      expect(m?.[1]).toContain(c);
  });
});

describe('kit controls take their height from the scale', () => {
  const read = (name: string, re: RegExp) =>
    expect(noComments(kitCss(name)), `${name}.css`).toMatch(re);
  it('Button / IconButton: height + square width are --ctl-h', () => {
    read('Button', /\.uibtn\)\s*\{[^}]*height:\s*var\(--ctl-h\)/);
    read('Button', /\.uibtn--icon\)\s*\{[^}]*width:\s*var\(--ctl-h\)/);
  });
  it('Segmented: outer track = --ctl-h, selected plate = --ctl-h - 2 x padding', () => {
    read('Segmented', /\.uiseg--track\s*\{[^}]*height:\s*var\(--seg-h\)/);
    read(
      'Segmented',
      /\.uiseg--track \.uiseg-opt\s*\{[^}]*height:\s*calc\(var\(--seg-h\) - 2 \* var\(--seg-pad\)\)/,
    );
    read('Segmented', /--seg-h:\s*var\(--ctl-h\)/);
  });
  it.each([
    ['Chip', /\.uichip\s*\{[^}]*height:\s*var\(--ctl-h\)/],
    ['Field', /\.uifield-box\s*\{[^}]*height:\s*var\(--ctl-h\)/],
    ['SearchField', /\.uisearch\s*\{[^}]*height:\s*var\(--ctl-h\)/],
    ['ScrollTabs', /\.stab-t\s*\{[^}]*height:\s*var\(--tab-h\)/],
    ['PresetChips', /\.uipc-chip\s*\{[^}]*height:\s*var\(--ctl-h\)/],
    ['BackButton', /\.uiback\s*\{[^}]*height:\s*var\(--ctl-h\)/],
  ])('%s.css sets height from the scale', (name, re) => read(name, re));
});
