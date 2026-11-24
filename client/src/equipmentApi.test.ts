import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import { equipmentHost, equipmentLive } from './equipmentApi';
import './equipment/equipmentBoot';

afterEach(() => addonsPref.reset());

describe('equipment seam', () => {
  it('the chunk provides the board and the picker sheet', () => {
    expect(equipmentHost.Board).not.toBeNull();
    expect(equipmentHost.PickerSheet).not.toBeNull();
  });
  it('is live only while the module is installed', () => {
    addonsPref.set([]);
    expect(equipmentLive()).toBe(false);
    addonsPref.set(['equipment']);
    expect(equipmentLive()).toBe(true);
  });
});
