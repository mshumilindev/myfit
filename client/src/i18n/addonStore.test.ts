import { describe, expect, it } from 'vitest';
import { ADDONS } from '../addons/manifest';
import { LOCALE_IDS } from './index';
import { ADDON_STORE_LOCALES, addonStoreStrings } from './addonStore';
import { addonStoreEn } from './addonStore.en';

const KEYS = Object.keys(addonStoreEn) as (keyof typeof addonStoreEn)[];

describe('addon store dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(ADDON_STORE_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
    expect(addonStoreStrings('en')).toBe(addonStoreEn);
  });
  it.each(LOCALE_IDS)('%s has every key and a name + description for every item', (id) => {
    const d = ADDON_STORE_LOCALES[id];
    expect(Object.keys(d).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(typeof d[k], `${id}.${k}`).toBe(typeof addonStoreEn[k]);
    for (const a of ADDONS) {
      const it = (d.items as Record<string, { name: string; desc: string }>)[a.id];
      expect(it?.name.length, `${id}.${a.id}.name`).toBeGreaterThan(0);
      expect(it?.desc.length, `${id}.${a.id}.desc`).toBeGreaterThan(0);
    }
    expect(Object.keys(d.items).sort()).toEqual(Object.keys(addonStoreEn.items).sort());
    expect(d.progress(2, 9)).toMatch(/2/);
  });
});
