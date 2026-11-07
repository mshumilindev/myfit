import { beforeEach, describe, expect, it } from 'vitest';
import { addonsPref, isAddonEnabled, migrateModules } from './enabledSet';

describe('migrateModules', () => {
  beforeEach(() => {
    localStorage.removeItem('spotter.addons.modules.v1');
    addonsPref.set(['apex', 'health']);
  });

  it('switches on the modules of an installed parent once', () => {
    migrateModules('member');
    expect(isAddonEnabled('mastery', 'member')).toBe(true);
    expect(isAddonEnabled('injury-log', 'member')).toBe(true);
  });

  it('does not bring a module back after the user turned it off', () => {
    migrateModules('member');
    addonsPref.set(['apex', 'health']);
    migrateModules('member');
    expect(isAddonEnabled('mastery', 'member')).toBe(false);
  });

  it('leaves parents that are not installed alone', () => {
    addonsPref.set(['apex']);
    migrateModules('member');
    expect(isAddonEnabled('injury-log', 'member')).toBe(false);
  });
});
