/** Coach Decisions strings (Lithuanian). See `coachDecisions.en.ts`. */
import type { decisionsEn } from './coachDecisions.en';
import { plural } from './coachPlural';

const decN = (n: number) =>
  plural('lt', n, {
    one: '{n} sprendimas',
    few: '{n} sprendimai',
    many: '{n} sprendimo',
    other: '{n} sprendimų',
  });

export const decisionsLt: typeof decisionsEn = {
  dcTitle: 'Sprendimai',
  dcGroupBy: 'Grupuoti pagal',
  dcGroupNone: 'Be grupavimo',
  dcGroupClient: 'Klientą',
  dcGroupResult: 'Rezultatą',
  dcGroupTrigger: 'Signalą',
  dcGroupMonth: 'Mėnesį',
  dcGrouped: 'Grupuota pagal',
  dcCount: decN,
  dcBig: (improved, total) => `${improved} iš ${total}`,
  dcBigRest: (pct) => `sprendimų pagerino rezultatą (${pct}%)`,
  dcHistory: 'Istorija',
  dcSearch: 'Ieškoti sprendimų',
  dcClearSearch: 'Išvalyti paiešką',
  dcFilterLabel: 'Rodyti sprendimus',
  dcAll: 'Visi',
  dcExport: 'Eksportuoti',
  dcExportSoon: 'Eksportas bus kitame atnaujinime',
  dcEmptyH: 'Sprendimų dar nėra',
  dcEmptyBody: 'Kai priimsite sprendimą dėl signalo, jis bus išsaugotas čia kartu su rezultatu.',
  dcToAgenda: 'Į „Darbotvarkę“',
  dcNoMatch: 'Nėra tinkamų sprendimų',
  dcClear: 'Išvalyti filtrus',
  dcOpen: (name) => `Atidaryti: ${name}`,
  dcList: 'Sprendimų sąrašas',
  dcMore: (n, left) => `Rodyti dar ${n} · liko ${left}`,
  dcLoading: 'Įkeliami sprendimai',
  dcWaiting: 'Laukiama',
  dcFailTitle: 'Nepavyko įkelti sprendimų',
  dcFailBody: 'Patikrinkite ryšį ir bandykite dar kartą.',
  dcTryAgain: 'Bandyti dar kartą',
};
