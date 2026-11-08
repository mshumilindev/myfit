import { afterEach, describe, expect, it } from 'vitest';
import { readAccountSettings } from './readSources';

describe('the export carries the add-on lists (SPO-511, Art. 15/20)', () => {
  afterEach(() => localStorage.clear());

  it('includes the installed set and the queue, driven by the key registry', () => {
    localStorage.setItem('spotter.addons', JSON.stringify({ list: ['learn'], updatedAt: 5 }));
    localStorage.setItem('spotter.addons.queue', JSON.stringify({ list: ['apex'], updatedAt: 6 }));
    localStorage.setItem(
      'spotter.addons.queue.modules',
      JSON.stringify({ list: ['mod-a'], updatedAt: 7 }),
    );
    const out = readAccountSettings();
    expect(out['spotter.addons.queue.modules']).toEqual({ list: ['mod-a'], updatedAt: 7 });
    expect(out['spotter.addons']).toEqual({ list: ['learn'], updatedAt: 5 });
    expect(out['spotter.addons.queue']).toEqual({ list: ['apex'], updatedAt: 6 });
  });
});
