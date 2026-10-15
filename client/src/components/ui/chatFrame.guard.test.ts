import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// SPO-115 (kit rule): a chat never restyles the room of the shared chat frame. ChatShell.css / ChatComposer.css own the
// gutters, the composer padding and the widths; a chat (Atlas, trainer, client, dock) only sets colour variables or its own
// inner parts. A rule outside those two files that sets padding / margin / gap / width / inset on the frame's containers
// is how the composer lost its side room in the Atlas chat once.
const SRC = join(__dirname, '../..');
const OWNERS = new Set(['ChatShell.css', 'ChatComposer.css']);
const CONTAINER = /\.(chs|chs-wrap|chs-page|chs-head|chs-body|chs-foot|uicomp|uicomp-row)(?![\w-])/;
const ROOM =
  /(^|[;\s{])(padding|margin|gap|row-gap|column-gap|width|min-width|max-width|inset|top|right|bottom|left)(-[a-z]+)*\s*:/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : walk(p);
    return p.endsWith('.css') ? [p] : [];
  });

describe('the chat frame room is set only by the kit', () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const file of walk(SRC)) {
    const name = file.split('/').pop() ?? '';
    if (OWNERS.has(name)) continue;
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      scanned++;
      const selector = m[1].trim();
      if (!CONTAINER.test(selector)) continue;
      if (ROOM.test(m[2]))
        offenders.push(`${file.replace(SRC, 'src')}: ${selector.replace(/\s+/g, ' ')}`);
    }
  }
  it('looked at real rules', () => expect(scanned).toBeGreaterThan(1000));
  it('no feature stylesheet sets padding / margin / gap / size on the frame containers', () => {
    expect(offenders).toEqual([]);
  });
});
