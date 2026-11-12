import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ADDONS } from '../addons/manifest';
import { addonStoreEn } from '../i18n/addonStore.en';
import { addonStoreEt } from '../i18n/addonStore.et';
import { addonStoreLt } from '../i18n/addonStore.lt';
import { addonStorePl } from '../i18n/addonStore.pl';
import { addonStoreUk } from '../i18n/addonStore.uk';

/** SPO-556: every app, add-on and theme of the store has an icon, and (unless "coming soon") a description in all 5 languages. */
const LOCALES = {
  en: addonStoreEn,
  uk: addonStoreUk,
  pl: addonStorePl,
  lt: addonStoreLt,
  et: addonStoreEt,
};
const shown = ADDONS.filter((a) => a.kind !== 'module');

describe('store info is complete', () => {
  it.each(shown.map((a) => a.id))('%s has an icon', (id) => {
    expect(existsSync(join(__dirname, '../../public/store-icons', `${id}.webp`))).toBe(true);
  });
  it.each(shown.map((a) => a.id))(
    '%s icon is 320x320 and fills the frame edge to edge',
    async (id) => {
      const file = join(__dirname, '../../public/store-icons', `${id}.webp`);
      const { data, info } = await sharp(file)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([320, 320]);
      const opaque = (x: number, y: number) => data[(y * 320 + x) * 4 + 3] > 128;
      const mid = 160;
      // the tile touches every edge: within 4 px of each side the middle is solid (corners may be rounded)
      expect(opaque(mid, 4) && opaque(mid, 315) && opaque(4, mid) && opaque(315, mid)).toBe(true);
    },
  );
  it.each(shown.filter((a) => !a.soon).map((a) => a.id))(
    '%s has a description in every language',
    (id) => {
      for (const [loc, st] of Object.entries(LOCALES)) {
        const it = (st.items as Record<string, { desc?: string; about?: string }>)[id];
        expect(it?.about?.length, `${loc}.${id}.about`).toBeGreaterThan(40);
        if (id !== 'holiday-themes')
          expect(it?.desc?.length, `${loc}.${id}.desc`).toBeGreaterThan(10);
      }
    },
  );
});
