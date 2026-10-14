import { plural } from './coachPlural';
import type { ProgramsStrings } from './coachPrograms.en';

const progN = (n: number) =>
  plural('pl', n, {
    one: '{n} program',
    few: '{n} programy',
    many: '{n} programów',
    other: '{n} programu',
  });
const clientN = (n: number) =>
  plural('pl', n, {
    one: '{n} klient',
    few: '{n} klientów',
    many: '{n} klientów',
    other: '{n} klienta',
  });

export const programsPl: ProgramsStrings = {
  pgTitle: 'Programy',
  pgSubtitle: (programs, clients) => `${progN(programs)}, ${clientN(clients)}`,
  pgListLabel: 'Programy',
  pgSearch: 'Szukaj programów',
  pgSearchClear: 'Wyczyść wyszukiwanie',
  pgNew: 'Nowy program',
  pgNewTitle: 'Dla kogo jest nowy program?',
  pgNewBody:
    'Programy powstają dla każdego klienta osobno. Wybierz klienta i zacznij od szablonu lub innego dnia.',
  pgNewLabel: 'Wybierz klienta dla nowego programu',
  pgClientsLine: (n, names) => `${clientN(n)}: ${names}`,
  pgNamesMore: (names, more) => `${names} +${more}`,
  pgFollow: (n) =>
    plural('pl', n, {
      one: 'Ten program realizuje {n} klient.',
      few: 'Ten program realizuje {n} klientów.',
      many: 'Ten program realizuje {n} klientów.',
      other: 'Ten program realizuje {n} klienta.',
    }),
  pgClientsLabel: 'Klienci tego programu',
  pgWeekWith: (week, days) => `Tydzień ${week} · z trenerem ${days}`,
  pgWeekSolo: (week) => `Tydzień ${week} · samodzielnie`,
  pgOpenEditor: 'Otwórz w edytorze',
  pgOpenFor: (name) => `Otwórz w edytorze: ${name}`,
  pgSharedTitle: 'Wspólny program',
  pgKeeps: (names, v) => `${names}: zostaje wersja v${v}, dopóki nie skopiujesz nowszej.`,
  pgBack: 'Programy',
  pgNoneH: 'Brak programów',
  pgNoneB: 'Utwórz program lub skopiuj szablon.',
  pgNoMatchH: 'Nic nie znaleziono',
  pgNoMatchB: 'Spróbuj innego słowa lub wyczyść wyszukiwanie.',
  pgFailTitle: 'Nie udało się wczytać programów',
  pgFailBody: 'Sprawdź połączenie i spróbuj ponownie.',
  pgRetry: 'Spróbuj ponownie',
};
