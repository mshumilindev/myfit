/** Coach Decisions strings (Polish). See `coachDecisions.en.ts`. */
import type { decisionsEn } from './coachDecisions.en';
import { plural } from './coachPlural';

const decN = (n: number) =>
  plural('pl', n, {
    one: '{n} decyzja',
    few: '{n} decyzje',
    many: '{n} decyzji',
    other: '{n} decyzji',
  });

export const decisionsPl: typeof decisionsEn = {
  dcTitle: 'Decyzje',
  dcGroupBy: 'Grupuj według',
  dcGroupNone: 'Bez grupowania',
  dcGroupClient: 'Klienta',
  dcGroupResult: 'Wyniku',
  dcGroupTrigger: 'Wyzwalacza',
  dcGroupMonth: 'Miesiąca',
  dcGrouped: 'Grupowanie',
  dcCount: decN,
  dcBig: (improved, total) => `${improved} z ${total}`,
  dcBigRest: (pct) => `decyzji przyniosło poprawę (${pct}%)`,
  dcHistory: 'Historia',
  dcSearch: 'Szukaj decyzji',
  dcClearSearch: 'Wyczyść wyszukiwanie',
  dcFilterLabel: 'Pokaż decyzje',
  dcAll: 'Wszystkie',
  dcExport: 'Eksport',
  dcExportSoon: 'Eksport pojawi się w następnej aktualizacji',
  dcEmptyH: 'Brak decyzji',
  dcEmptyBody: 'Gdy zdecydujesz w sprawie sygnału, zapiszemy ją tutaj razem z wynikiem.',
  dcToAgenda: 'Przejdź do widoku Agenda',
  dcNoMatch: 'Brak pasujących decyzji',
  dcClear: 'Wyczyść filtry',
  dcOpen: (name) => `Otwórz: ${name}`,
  dcList: 'Lista decyzji',
  dcMore: (n, left) => `Pokaż jeszcze ${n} · zostało ${left}`,
  dcLoading: 'Wczytywanie decyzji',
  dcWaiting: 'Oczekuje',
  dcFailTitle: 'Nie udało się wczytać decyzji',
  dcFailBody: 'Sprawdź połączenie i spróbuj ponownie.',
  dcTryAgain: 'Spróbuj ponownie',
};
