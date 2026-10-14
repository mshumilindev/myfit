import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exerciseImage } from './exercises';

/** R-KIT-09: the EZ-bar skullcrusher (used by the starter plan and the Coach fixtures) has a real photo on disk. */
describe('skullcrusher photo', () => {
  it.each(['EZ-Bar Skullcrusher', 'ez-bar skullcrusher'])(
    '%s resolves to an existing file',
    (name) => {
      const url = exerciseImage(name);
      expect(url).toBeTruthy();
      expect(url).toMatch(/Skullcrusher/i);
      expect(
        existsSync(resolve(__dirname, '../../public', (url as string).replace(/^\//, ''))),
      ).toBe(true);
    },
  );
});
