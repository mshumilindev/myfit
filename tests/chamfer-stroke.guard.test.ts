/**
 * Chamfer stroke guard: a themed diagonal stroke on a cut corner takes the colour of the element's own border
 * (`--bd`, set next to `border-color`), and the app accent only where the element has no coloured border.
 * A kit rule that sets a toned `border-color` without the matching `--bd` would cut that element with the
 * accent instead (docs/ADD-A-THEME.md, "діагональні штрихи").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const UI = join(__dirname, '..', 'client', 'src', 'components', 'ui');
const NEUTRAL = /^(transparent|var\(--color-(divider|border)\)|inherit|currentcolor)$/i;

describe('chamfer stroke follows the border', () => {
  for (const file of ['Card.css', 'Button.css']) {
    it(`${file}: every toned border-color has a matching --bd`, () => {
      const root = postcss.parse(readFileSync(join(UI, file), 'utf8'));
      const bad: string[] = [];
      root.walkRules((rule) => {
        let border: string | undefined;
        let bd: string | undefined;
        rule.each((n) => {
          if (n.type !== 'decl') return;
          if (n.prop === 'border-color') border = n.value.trim();
          if (n.prop === '--bd') bd = n.value.trim();
        });
        if (border && !NEUTRAL.test(border) && bd !== border) bad.push(rule.selector);
      });
      expect(bad).toEqual([]);
    });
  }
});
