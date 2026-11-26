/**
 * The first and last row of a list take the list's rounded corners, so a keyboard focus ring (inset outline) follows the
 * surface instead of being cut square by its `overflow: hidden`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'GroupedList.css'), 'utf8');

describe('GroupedList focus ring corners', () => {
  it('rounds the top corners of the first row and the bottom corners of the last', () => {
    expect(css).toMatch(
      /\.uigl-rows > \.uirow:first-child[^{]*\{[^}]*border-top-left-radius: var\(--radius-lg\);[^}]*border-top-right-radius: var\(--radius-lg\);/,
    );
    expect(css).toMatch(
      /\.uigl-rows > \.uirow:last-child[^{]*\{[^}]*border-bottom-left-radius: var\(--radius-lg\);[^}]*border-bottom-right-radius: var\(--radius-lg\);/,
    );
  });
  it('covers the list variant (rows inside li) and leaves the flat variant square', () => {
    expect(css).toContain('.uigl-rows > li:first-child > .uirow');
    expect(css).toMatch(/\.uigl--flat \.uigl-rows > \.uirow[^{]*\{[^}]*border-radius: 0;/);
  });
});
