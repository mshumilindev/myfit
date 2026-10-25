import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two kit components must not own the same class name: the later-loaded stylesheet silently restyles the other
 * (StepList's `.uistep-row` padding once squeezed NumberStepper's value and clipped the digits in the set logger).
 * States.css, Chamfer.css and Floor.css are the deliberate cross-cutting sheets (every state / every cut-corner surface in one
 * place, keyed on the owners' classes); they style what the owners define and own none of it.
 * Only a class that STARTS a rule (`.x {`, `.x:hover {`, `.x.y {`) counts as ownership; `.a .x` is a descendant override.
 */
const CROSS_CUTTING = new Set(['States.css', 'Chamfer.css', 'Floor.css']);

describe('kit CSS: class ownership', () => {
  const dir = __dirname;
  const owners = new Map<string, Set<string>>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css') && !CROSS_CUTTING.has(n))) {
    const css = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(
      /(?:^|[}\n,])\s*\.(ui[a-z0-9]+(?:-[a-z0-9]+)*)(?=[\s:.,{[>+~])/g,
    )) {
      const set = owners.get(m[1]) ?? new Set<string>();
      set.add(f);
      owners.set(m[1], set);
    }
  }
  it('every ui* class is defined by one stylesheet only', () => {
    const clash = [...owners]
      .filter(([, s]) => s.size > 1)
      .map(([c, s]) => `.${c}: ${[...s].join(', ')}`);
    expect(clash).toEqual([]);
  });
});
