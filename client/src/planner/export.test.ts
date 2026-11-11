import { beforeEach, describe, expect, it } from 'vitest';
import { addonExportParts } from '../legal/export/addonExport';
import { plannerHost } from '../plannerRt';

beforeEach(() => {
  plannerHost.exportFiles = null;
});

describe('Planner in the data export (Art. 15 / 20)', () => {
  it('names itself as not included while its code is not loaded (the data is stored, never silently left out)', () => {
    const p = addonExportParts();
    expect(p.files).toEqual([]);
    expect(p.missing.some((m) => m.item.startsWith('Planner') && m.reason === 'feature-off')).toBe(
      true,
    );
  });
  it('adds its files once loaded', async () => {
    await import('./plannerBoot');
    const p = addonExportParts();
    expect(p.files.map((f) => f.name)).toEqual(['planner-plans.json', 'planner-availability.json']);
    expect(p.missing.some((m) => m.item.startsWith('Planner'))).toBe(false);
  });
});
