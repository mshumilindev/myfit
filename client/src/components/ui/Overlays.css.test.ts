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
    expect(cap).toBe('var(--sheet-room)');
    expect(full).toBe('var(--sheet-room)');
  });

  it('the room is the viewport minus the safe area and the --s-8 gap, not a fixed pixel offset', () => {
    const room = /--sheet-room:\s*([^;]+);/.exec(block('\n.sheet'))?.[1];
    expect(room).toBe('calc(100dvh - var(--safe-top, 0px) - var(--s-8))');
    expect(room).not.toContain('46px');
  });
});
