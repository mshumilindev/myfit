import { describe, expect, it } from 'vitest';
import { TONES, toneClass } from './tones';
import { kitCss, stylesCss } from './readCss';

const STYLES = stylesCss();
const TONES_CSS = kitCss('tones');
const BADGE_CSS = kitCss('Badge');

/** token name → value, first definition wins (the :root block comes first). */
const tokens = new Map<string, string>();
for (const m of STYLES.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim());
}

function resolve(value: string, depth = 0): string {
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
  if (!ref || depth > 8) return v;
  const next = tokens.get(ref[1]) ?? ref[2];
  if (next == null) throw new Error(`unresolved ${ref[1]}`);
  return resolve(next, depth + 1);
}
const token = (name: string) => resolve(`var(${name})`);

function lum(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast helper', () => {
  it('black on white is 21:1, same colour is 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});

describe('share and note tone families', () => {
  it('are registered tones with a class that binds all five variables', () => {
    for (const t of ['share', 'note'] as const) {
      expect(TONES).toContain(t);
      expect(toneClass(t)).toBe(`uit--${t}`);
      const block = TONES_CSS.match(new RegExp(`\\.uit--${t}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      for (const v of ['--t-base', '--t-tint', '--t-text', '--t-line', '--t-on'])
        expect(block, `${t} ${v}`).toContain(v);
    }
  });

  it.each(['share', 'note'])('%s has base / tint / text / line tokens in :root', (t) => {
    for (const part of ['', '-tint', '-text', '-line'])
      expect(tokens.has(`--color-${t}${part}`), `--color-${t}${part}`).toBe(true);
  });

  it.each(['share', 'note'])('%s text on its tint is >= 4.5:1', (t) => {
    expect(contrast(token(`--color-${t}-text`), token(`--color-${t}-tint`))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(['share', 'note'])('%s base (edge / icon) on the page background is >= 3:1', (t) => {
    expect(contrast(token(`--color-${t}`), token('--color-bg'))).toBeGreaterThanOrEqual(3);
  });

  it('share (blue) and note (brass) are distinct swatches', () => {
    expect(token('--color-share')).not.toBe(token('--color-note'));
    expect(token('--color-share-tint')).not.toBe(token('--color-note-tint'));
  });
});

describe('coach tone family', () => {
  it('is registered with a class that binds all five variables', () => {
    expect(TONES).toContain('coach');
    expect(toneClass('coach')).toBe('uit--coach');
    const block = TONES_CSS.match(/\.uit--coach\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const v of ['--t-base', '--t-tint', '--t-text', '--t-line', '--t-on'])
      expect(block, v).toContain(v);
  });
  it('has base / tint / text / line tokens; text on tint >= 4.5, base on page >= 3', () => {
    for (const part of ['', '-tint', '-text', '-line'])
      expect(tokens.has(`--color-coach${part}`), `--color-coach${part}`).toBe(true);
    expect(
      contrast(token('--color-coach-text'), token('--color-coach-tint')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--color-coach'), token('--color-bg'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token('--color-bg'), token('--color-coach'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('badge colours (R-FE-010)', () => {
  const pairs: Record<string, [string, string]> = {
    danger: ['--color-on-solid', '--color-danger-solid'],
    accent: ['--c-201a0e', '--color-accent'],
    neutral: ['--color-on-solid', '--color-neutral-700'],
  };
  it.each(Object.entries(pairs))('%s badge ink on fill is >= 4.5:1', (_n, [ink, bg]) => {
    expect(contrast(token(ink), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('badge CSS uses exactly these tokens (so the test checks the real colours)', () => {
    expect(BADGE_CSS).toContain('var(--color-danger-solid)');
    expect(BADGE_CSS).toContain('var(--color-on-solid)');
    expect(BADGE_CSS).toContain('var(--c-201a0e)');
    expect(BADGE_CSS).toContain('var(--color-neutral-700)');
  });

  it('is 12px bold with an 18px minimum', () => {
    expect(BADGE_CSS).toContain('min-width: 18px');
    expect(BADGE_CSS).toContain('height: 18px');
    expect(BADGE_CSS).toContain('font-size: var(--fs-12)');
    expect(BADGE_CSS).toContain('font-weight: 700');
    expect(token('--fs-12')).toBe('12px');
  });
});
