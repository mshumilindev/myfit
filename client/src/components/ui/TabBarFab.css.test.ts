import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// jsdom does not run the cascade, so the contract of the Start fab → × (SPO-470) is pinned in the source.
const css = readFileSync(resolve(process.cwd(), 'src/components/ui/TabBar.css'), 'utf8');

describe('Start fab → × stylesheet (SPO-470)', () => {
  it('turns only the plus icon by the agreed 135° and back with the same transition', () => {
    expect(css).toMatch(/--fab-turn:\s*135deg/);
    expect(css).toMatch(/\.tabbar-fab > \.ui-icon\s*\{[^}]*transition:\s*transform/);
    expect(css).toMatch(/\.tabbar-fab\.is-open > \.ui-icon\s*\{[^}]*rotate\(var\(--fab-turn\)\)/);
  });

  it('draws the open button as a twin in the portal layer, above the Start drawer (z-60), hidden when something opens on top', () => {
    expect(css).toMatch(
      /\.tabbar-fab-layer\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*var\(--z-60\)/,
    );
    expect(css).toMatch(/\.tabbar-fab-layer\.is-covered\s*\{[^}]*opacity:\s*0/);
    // the real button (and its ripple) keeps existing under the drawer — hiding it made the ripple vanish and reappear
    expect(css).not.toMatch(/\.tabbar-wrap--fab-open > \.tabbar-fab\s*\{[^}]*visibility/);
  });

  it('switches the turn off for reduced motion', () => {
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^}]*\.tabbar-fab > \.ui-icon\s*\{[^}]*transition:\s*none/,
    );
  });
});
