import { describe, expect, it } from 'vitest';
import { addonExportParts, registerAddonExport } from './addonExport';

describe('addon export registry', () => {
  it('a reader that unregisters is no longer asked', () => {
    const off = registerAddonExport('x-test', () => ({
      files: [],
      missing: [{ id: 'x' } as never],
    }));
    expect(addonExportParts().missing.length).toBe(1);
    off();
    expect(addonExportParts().missing.length).toBe(0);
  });
});
