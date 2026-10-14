// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { configureCalendarSettings, saveCalendarSettings } from '../../schedule/calendarSettings';
import { defaultSettings } from '../../schedule/hours';
import { createSealedCalendarSettingsPort, calendarSettingsPath } from './calendarSettingsPort';
import { T, makeWorld } from './testWorld';

describe('sealed calendar settings', () => {
  it('round-trips and leaves only updatedAt in the open', async () => {
    const w = await makeWorld();
    const port = createSealedCalendarSettingsPort({ fs: w.fs, vault: w.tv, uid: T });
    expect(await port.load()).toBeNull();
    const s = {
      ...defaultSettings(),
      gymIds: ['gym-secret-7f3a'],
      range: 'working' as const,
      working: [{ start: 360, end: 1380 }, null, null, null, null, null, null],
    };
    await port.save(s);
    const raw = await w.fs.get(calendarSettingsPath(T));
    expect(Object.keys(raw as object).sort()).toEqual(['enc', 'updatedAt']);
    const text = JSON.stringify(raw);
    expect(text).not.toContain('gym-secret-7f3a');
    expect(text).not.toContain('"working"');
    expect(text).not.toContain('"range"');
    expect(await port.load()).toEqual(s);
  });

  it('the store rolls back when the sealed write fails and reports it', async () => {
    const w = await makeWorld();
    const real = createSealedCalendarSettingsPort({ fs: w.fs, vault: w.tv, uid: T });
    configureCalendarSettings({
      load: () => real.load(),
      save: () => Promise.reject(new Error('vault-locked')),
    });
    const ok = await saveCalendarSettings({ ...defaultSettings(), range: '24h' });
    expect(ok).toBe(false);
    configureCalendarSettings(null);
  });
});
