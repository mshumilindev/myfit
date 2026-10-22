import { useT, type LocaleId } from './index';
import { myDataEn } from './myData.en';
import { myDataPl } from './myData.pl';
import { myDataUk } from './myData.uk';

/**
 * Words of "What Spotter knows about you" and "Stored on this device" (SPO-295 N5, N7; designs mydata*, cleardevice).
 * English, Ukrainian and Polish; Lithuanian and Estonian read the English text like the other legal strings. uk/pl are
 * machine translations that need a native read before launch. No number lives here: counts come from real stores.
 */
export type AreaId =
  | 'account'
  | 'training'
  | 'sleepbody'
  | 'health'
  | 'atlas'
  | 'gyms'
  | 'sharing'
  | 'chat'
  | 'device'
  | 'notifications'
  | 'consents';
/** The areas that have a data page of their own (the other two open the device page and the consent history). */
export type DataAreaId = Exclude<AreaId, 'device' | 'consents'>;

export type LineId =
  | 'accProfile'
  | 'accSignin'
  | 'accLogs'
  | 'trSessions'
  | 'trSets'
  | 'trActivities'
  | 'trRest'
  | 'trPrograms'
  | 'sbWeighIns'
  | 'sbNights'
  | 'sbNutrition'
  | 'hInjuries'
  | 'hConditions'
  | 'hCycle'
  | 'hNicotine'
  | 'hAlcohol'
  | 'hSupplements'
  | 'atChat'
  | 'atAi'
  | 'gyGyms'
  | 'gyVisits'
  | 'gySearch'
  | 'shTrainer'
  | 'shSee'
  | 'chMessages'
  | 'noDevice';

export type DeviceId =
  | 'signin'
  | 'offline'
  | 'cache'
  | 'settings'
  | 'atlas'
  | 'consent'
  | 'reminders'
  | 'gymsearch'
  | 'other'
  | 'idbCoachChat'
  | 'idbSigner'
  | 'idbAvatars'
  | 'idbVault'
  | 'idbPrefs'
  | 'idbFirestore'
  | 'idbOther'
  | 'appFiles';

export interface LineText {
  label: string;
  sub: string;
}
export interface PageText {
  who: string;
  where: string;
  keep: string;
  note?: string;
}

export interface MyDataStrings {
  title: string;
  sub: string;
  /** the row in Your privacy */
  hubSub: string;
  notice: string;
  groupData: string;
  groupTake: string;
  takeLabel: string;
  takeFoot: string;
  groupDelete: string;
  areas: Record<AreaId, { title: string; sub: string }>;
  pages: Record<DataAreaId, PageText>;
  lines: Record<LineId, LineText>;
  /** values of a row that is not a number */
  has: string;
  none: string;
  on: string;
  off: string;
  given: string;
  notGiven: string;
  hStored: string;
  hWho: string;
  hWhere: string;
  hKeep: string;
  hOptions: string;
  whereLabel: string;
  keepLabel: string;
  noActions: string;
  /** Delete one health feature's data (the existing two-step prompt) */
  delFeature: (feature: string) => string;
  delFailed: string;
  /** Clear the Atlas chat */
  clearChat: string;
  clearChatTitle: string;
  clearChatBody: string;
  clearChatConfirm: string;
  cancel: string;
  openSharing: string;
  openSharingSub: string;
  openDevice: string;
  /** Consent history */
  histSub: string;
  histHeader: string;
  histFoot: string;
  histEmpty: string;
  histGiven: (what: string) => string;
  histWithdrawn: (what: string) => string;
  histVersion: (v: string, when: string) => string;
  histTrainerTerms: string;
  histTerms: string;
  histPolicy: string;
  histAge: string;
  /** Stored on this device */
  devSub: string;
  devNotice: string;
  devHeadNeeded: string;
  devHeadOptional: string;
  devHeadOther: string;
  devHeadClear: string;
  devLoading: string;
  devMeasure: (kb: string) => string;
  devItems: (n: number) => string;
  devMessages: (n: number) => string;
  devTotal: (size: string) => string;
  devNoList: string;
  devClear: string;
  devClearFoot: string;
  devClearTitle: string;
  devClearBody: string;
  devClearConfirm: string;
  devClearFailed: string;
  device: Record<DeviceId, LineText>;
}

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
