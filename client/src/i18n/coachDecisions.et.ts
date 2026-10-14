/** Coach Decisions strings (Estonian). See `coachDecisions.en.ts`. */
import type { decisionsEn } from './coachDecisions.en';
import { plural } from './coachPlural';

const decN = (n: number) => plural('et', n, { one: '{n} otsus', other: '{n} otsust' });

export const decisionsEt: typeof decisionsEn = {
  dcTitle: 'Otsused',
  dcGroupBy: 'Rühmita',
  dcGroupNone: 'Rühmitamata',
  dcGroupClient: 'Kliendi järgi',
  dcGroupResult: 'Tulemuse järgi',
  dcGroupTrigger: 'Päästiku järgi',
  dcGroupMonth: 'Kuu järgi',
  dcGrouped: 'Rühmitatud',
  dcCount: decN,
  dcBig: (improved, total) => `${improved} / ${total}`,
  dcBigRest: (pct) => `otsust parandas tulemust (${pct}%)`,
  dcHistory: 'Ajalugu',
  dcSearch: 'Otsi otsuseid',
  dcClearSearch: 'Tühjenda otsing',
  dcFilterLabel: 'Näita otsuseid',
  dcAll: 'Kõik',
  dcExport: 'Ekspordi',
  dcExportSoon: 'Eksport tuleb järgmise uuendusega',
  dcEmptyH: 'Otsuseid veel pole',
  dcEmptyBody: 'Kui teed signaali kohta otsuse, salvestatakse see siia koos tulemusega.',
  dcToAgenda: 'Päevakava juurde',
  dcNoMatch: 'Sobivaid otsuseid pole',
  dcClear: 'Tühista filtrid',
  dcOpen: (name) => `Ava: ${name}`,
  dcList: 'Otsuste loend',
  dcMore: (n, left) => `Näita veel ${n} · jäänud ${left}`,
  dcLoading: 'Otsuseid laaditakse',
  dcWaiting: 'Ootel',
  dcFailTitle: 'Otsuseid ei õnnestunud laadida',
  dcFailBody: 'Kontrolli ühendust ja proovi uuesti.',
  dcTryAgain: 'Proovi uuesti',
};
