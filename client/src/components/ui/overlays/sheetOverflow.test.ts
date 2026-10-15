import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findHorizontalOverflow } from './sheetOverflow';

function box(el: HTMLElement, right: number, width = 100) {
  el.getBoundingClientRect = () =>
    ({ right, left: right - width, width, top: 0, bottom: 0, height: 0 }) as DOMRect;
}
function sheet(scrollWidth: number, clientWidth: number) {
  const root = document.createElement('div');
  Object.defineProperty(root, 'scrollWidth', { value: scrollWidth });
  Object.defineProperty(root, 'clientWidth', { value: clientWidth });
  box(root, 320, 320);
  return root;
}

describe('findHorizontalOverflow', () => {
  it('reports nothing when the sheet does not scroll sideways', () => {
    const root = sheet(320, 320);
    const a = document.createElement('div');
    root.append(a);
    box(a, 999);
    expect(findHorizontalOverflow(root)).toEqual([]);
  });

  it('names the elements that stick out of a sheet that scrolls sideways', () => {
    const root = sheet(420, 320);
    const ok = document.createElement('div');
    const wide = document.createElement('div');
    root.append(ok, wide);
    box(ok, 300);
    box(wide, 420);
    expect(findHorizontalOverflow(root)).toEqual([wide]);
  });

  it('skips content inside an own scroll container (data-hscroll-ok), not the container itself', () => {
    const root = sheet(420, 320);
    const row = document.createElement('div');
    row.setAttribute('data-hscroll-ok', '');
    const chip = document.createElement('span');
    row.append(chip);
    root.append(row);
    box(row, 320);
    box(chip, 600);
    expect(findHorizontalOverflow(root)).toEqual([]);
  });
});

describe('drawer layout contract (Overlays.css)', () => {
  const css = readFileSync(join(__dirname, '..', 'Overlays.css'), 'utf8');
  it('keeps content inside the drawer by layout', () => {
    expect(css).toMatch(/\.sheet\s*\{\s*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.sheet\s*:where\([^)]*div[^)]*\)\s*\{\s*min-width:\s*0/);
  });
  it('never hides the overflow instead of fixing it', () => {
    const rules = [...css.matchAll(/(^|\})\s*([^{}]*\.sheet[^{},]*)\{([^}]*)\}/g)];
    const hiding = rules.filter((m) => /overflow-x:\s*(hidden|clip)/.test(m[3]));
    expect(hiding.map((m) => m[2].trim())).toEqual([]);
  });
});
