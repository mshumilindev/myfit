import { inlinePrimitives } from './components/ui/readCss';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// .focus-scroll overlaps the bottom bar by design (SPO-11 glow), so the bar must sit above it.
describe('session focus view: bottom bar stacking', () => {
  const css = inlinePrimitives(readFileSync(join(__dirname, 'styles.css'), 'utf8'));
  const rule = /\n\.focus-nav \{([^}]*)\}/.exec(css)?.[1] ?? '';
  it('.focus-nav is positioned with a z-index and an opaque fill', () => {
    expect(rule).toMatch(/position:\s*relative/);
    expect(rule).toMatch(/z-index:\s*[1-9]/);
    expect(rule).toMatch(/background:\s*var\(--color-bg\)/);
  });
});
