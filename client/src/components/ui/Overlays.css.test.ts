import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'Overlays.css'), 'utf8');
const block = (sel: string) => {
  const i = css.indexOf(`${sel} {`);
  return css.slice(i, css.indexOf('}', i));
};

describe('sheet height room', () => {
  it('compact cap equals the full-height room, so there is no band where a drawer is full with empty space', () => {
    const cap = /max-height:\s*([^;]+);/.exec(block('\n.sheet'))?.[1];
    const full = /height:\s*([^;]+);/.exec(block('.sheet.sheet-full'))?.[1];
    expect(cap).toBeTruthy();
    expect(cap).toBe(full);
  });
});
