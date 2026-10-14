import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const rule = (src: string, sel: string): string => {
  const at = src.indexOf(`${sel} {`);
  expect(at, sel).toBeGreaterThanOrEqual(0);
  return src.slice(at, src.indexOf('}', at));
};

describe('More / account popover insets are symmetrical', () => {
  const more = css('MoreMenu.css');

  it('a destinations list has the same inset (s-8) on all four sides', () => {
    expect(rule(more, '.uimore-list')).toMatch(/padding: var\(--s-8\);/);
  });

  it('stacked lists share one gap; only a list above the account block drops its bottom', () => {
    expect(rule(more, '.uimore-list + .uimore-list')).toMatch(/padding-top: 0/);
    expect(rule(more, '.uimore-list:has(+ .uiacct)')).toMatch(/padding-bottom: 0/);
  });

  it('the account block pads all four sides equally (popover)', () => {
    expect(rule(css('AccountPanel.css'), '.uiacct')).toMatch(/padding: var\(--s-16\);/);
  });

  it('the phone sheet keeps the home-indicator inset under the content', () => {
    expect(rule(css('Overlays.css'), '.sheet')).toMatch(
      /calc\(var\(--space-8\) \+ var\(--safe-bottom\)\)/,
    );
  });
});
