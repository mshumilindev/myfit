import { describe, expect, it } from 'vitest';

describe('look bundles', () => {
  it('each bundle module loads (its CSS, tokens and fonts ride with it)', async () => {
    for (const id of ['cyberpunk', 'halloween', 'christmas', 'glass']) {
      const m = (await import(`./bundles/${id}.ts`)) as { BUNDLE: string };
      expect(m.BUNDLE).toBe(id);
    }
  });
  it('all.ts ships every look at once and marks them ready (Storybook, audits)', async () => {
    const { themeCssReady } = await import('./lazy');
    await import('./all');
    expect(themeCssReady('cyberpunk')).toBe(true);
  });
});
