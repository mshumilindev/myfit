import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// SPO-5: the progress svg is the ring's DIRECT child. A descendant selector (`.uiring svg`) also caught the
// glyph's own svg inside the middle (the "trained today" check) and pinned it to the top-left corner.
const css = readFileSync(join(__dirname, 'Ring.css'), 'utf8');

describe('Ring: the middle glyph is not positioned like the progress svg', () => {
  it('only the direct svg is absolutely placed', () => {
    expect(css).toMatch(/\.uiring > svg \{\s*position: absolute;\s*inset: 0;/);
    expect(css).not.toMatch(/\.uiring svg \{/);
  });
});
