/**
 * Add-on Store dictionary (SPO-513).
 *
 *   const { st } = useAddonStoreT();   st.title, st.progress(2, 9), st.items.sleep.name ...
 */
import { useT, type LocaleId } from './index';
import { addonStoreEn } from './addonStore.en';
import { addonStoreUk } from './addonStore.uk';
import { addonStorePl } from './addonStore.pl';
import { addonStoreLt } from './addonStore.lt';
import { addonStoreEt } from './addonStore.et';

export type AddonStoreStrings = typeof addonStoreEn;

export const ADDON_STORE_LOCALES: Record<LocaleId, AddonStoreStrings> = {
  en: addonStoreEn,
  uk: addonStoreUk,
  pl: addonStorePl,
  lt: addonStoreLt,
  et: addonStoreEt,
};

export const addonStoreStrings = (locale: LocaleId): AddonStoreStrings =>
  ADDON_STORE_LOCALES[locale];

export function useAddonStoreT(): { st: AddonStoreStrings; locale: LocaleId } {
  const { locale } = useT();
  return { st: ADDON_STORE_LOCALES[locale], locale };
}
