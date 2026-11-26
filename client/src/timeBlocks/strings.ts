import type { LocaleId } from '../i18n';
import type { BlockFormat } from './model';

/** Words of the time-block screens. The module's own words live in its chunk, not in the core i18n (add-on boundary). */
export interface TimeBlocksStrings {
  getReady: string;
  getInPosition: string;
  clockRunning: string;
  go: string;
  cancel: string;
  formats: Record<BlockFormat, string>;
}

const en: TimeBlocksStrings = {
  getReady: 'Get ready',
  getInPosition: 'Get in position',
  clockRunning: 'Clock running',
  go: 'GO',
  cancel: 'Cancel',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'For time', intervals: 'Intervals' },
};
const uk: TimeBlocksStrings = {
  getReady: 'Приготуйтесь',
  getInPosition: 'Займіть позицію',
  clockRunning: 'Час іде',
  go: 'СТАРТ',
  cancel: 'Скасувати',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'На час', intervals: 'Інтервали' },
};
const pl: TimeBlocksStrings = {
  getReady: 'Przygotuj się',
  getInPosition: 'Przyjmij pozycję',
  clockRunning: 'Czas leci',
  go: 'START',
  cancel: 'Anuluj',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'Na czas', intervals: 'Interwały' },
};
const lt: TimeBlocksStrings = {
  getReady: 'Pasiruoškite',
  getInPosition: 'Užimkite padėtį',
  clockRunning: 'Laikas eina',
  go: 'START',
  cancel: 'Atšaukti',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'Į laiką', intervals: 'Intervalai' },
};
const et: TimeBlocksStrings = {
  getReady: 'Valmistu',
  getInPosition: 'Võta asend',
  clockRunning: 'Aeg jookseb',
  go: 'START',
  cancel: 'Tühista',
  formats: { amrap: 'AMRAP', emom: 'EMOM', fortime: 'Ajale', intervals: 'Intervallid' },
};

export const STRINGS: Record<LocaleId, TimeBlocksStrings> = { en, uk, pl, lt, et };
