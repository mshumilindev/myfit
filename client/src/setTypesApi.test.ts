import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import {
  isExtraSetType,
  setTypeHidden,
  setTypeOffered,
  setTypesHost,
  setTypesLive,
  shownSetType,
} from './setTypesApi';
import { GhostDrops } from './setTypes/GhostDrops';
import { DropBody } from './setTypes/DropBody';

beforeEach(() => addonsPref.reset());
afterEach(() => {
  setTypesHost.DropBody = null;
  setTypesHost.GhostDrops = null;
  addonsPref.reset();
});

describe('Set types seam, module off (neutral contract)', () => {
  it('offers only working and warm-up, and hides the three extra types', () => {
    expect(setTypesLive()).toBe(false);
    expect(setTypeOffered('working')).toBe(true);
    expect(setTypeOffered('warmup')).toBe(true);
    for (const t of ['drop', 'reverse-drop', 'static-dynamic'] as const) {
      expect(isExtraSetType(t)).toBe(true);
      expect(setTypeOffered(t)).toBe(false);
      expect(setTypeHidden(t)).toBe(true);
      expect(shownSetType(t)).toBe('working');
    }
  });
  it('never hides working / warm-up, and a stopwatch hold stays a hold', () => {
    expect(setTypeHidden('working')).toBe(false);
    expect(shownSetType('warmup')).toBe('warmup');
    expect(setTypeHidden('static-dynamic', true)).toBe(false);
    expect(shownSetType('static-dynamic', true)).toBe('static-dynamic');
    expect(shownSetType('drop', true)).toBe('working');
  });
});

describe('Set types seam, module on', () => {
  it('stays neutral until the chunk has loaded', () => {
    addonsPref.set(['set-types']);
    expect(setTypesLive()).toBe(false);
    expect(setTypeOffered('drop')).toBe(false);
  });
  it('offers and shows every type once installed and loaded', () => {
    addonsPref.set(['set-types']);
    setTypesHost.DropBody = DropBody;
    setTypesHost.GhostDrops = GhostDrops;
    expect(setTypesLive()).toBe(true);
    for (const t of ['drop', 'reverse-drop', 'static-dynamic'] as const) {
      expect(setTypeOffered(t)).toBe(true);
      expect(shownSetType(t)).toBe(t);
    }
  });
  it('goes neutral again when removed, with nothing stored changed', () => {
    addonsPref.set(['set-types']);
    setTypesHost.DropBody = DropBody;
    setTypesHost.GhostDrops = GhostDrops;
    addonsPref.reset();
    expect(setTypesLive()).toBe(false);
    expect(shownSetType('drop')).toBe('working');
  });
});
