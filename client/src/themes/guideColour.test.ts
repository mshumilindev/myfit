import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guide family colour rule (owner 11.11.2026): the theme's own Learn colour when it is genuinely separate
// (not the accent, not monochrome), otherwise the reserved pink #e5537e. Default = derived from Learn
// (styles.css); a theme whose Learn equals its accent (every studio accent) or is monochrome overrides it with the pink.
const PINK = 'var(--c-e5537e)';
const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('guide colour tokens', () => {
  it('derive from Learn by default', () => {
    const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
    for (const k of ['', '-tint', '-text', '-line']) {
      expect(css).toContain(`--color-guide${k}: var(--color-learn${k});`);
    }
  });

  it('a theme override is always the reserved pink (never an accent or orange)', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.css'));
    for (const f of files) {
      for (const m of read(f).matchAll(/--color-guide:\s*([^;]+);/g)) {
        expect(m[1].trim(), f).toBe(PINK);
      }
    }
  });

  it('every studio accent falls back to the pink (Learn = accent there): no accent file derives from Learn', () => {
    for (const f of readdirSync(__dirname).filter((n) => n.startsWith('_studio.axes.'))) {
      expect(read(f), f).not.toMatch(/--color-guide:\s*var\(--color-learn\)/);
    }
    expect(read('studio.css')).toContain(`--color-guide: ${PINK};`);
    expect(read('_studio.axes.light.css')).toContain(`--color-guide: ${PINK};`);
  });
});
