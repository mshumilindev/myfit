import { useT, type LocaleId } from './index';
import { myDataEn } from './myData.en';
import { myDataPl } from './myData.pl';
import { myDataUk } from './myData.uk';
import type { MyDataStrings } from './myData.types';
export type {
  AreaId,
  DataAreaId,
  DeviceId,
  LineId,
  LineText,
  MyDataStrings,
  PageText,
} from './myData.types';

const LOCALES: Partial<Record<LocaleId, MyDataStrings>> = {
  en: myDataEn,
  uk: myDataUk,
  pl: myDataPl,
};

export const myDataTexts = (locale: LocaleId): MyDataStrings => LOCALES[locale] ?? myDataEn;
export const MY_DATA_LOCALES = LOCALES;

export function useMyDataT(): MyDataStrings {
  return myDataTexts(useT().locale);
}
