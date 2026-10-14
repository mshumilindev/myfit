import { plural } from './coachPlural';
import type { ProgramsStrings } from './coachPrograms.en';

const progN = (n: number) =>
  plural('lt', n, {
    one: '{n} programa',
    few: '{n} programos',
    many: '{n} programos',
    other: '{n} programų',
  });
const clientN = (n: number) =>
  plural('lt', n, {
    one: '{n} klientas',
    few: '{n} klientai',
    many: '{n} kliento',
    other: '{n} klientų',
  });

export const programsLt: ProgramsStrings = {
  pgTitle: 'Programos',
  pgSubtitle: (programs, clients) => `${progN(programs)}, ${clientN(clients)}`,
  pgListLabel: 'Programos',
  pgSearch: 'Ieškoti programų',
  pgSearchClear: 'Išvalyti paiešką',
  pgNew: 'Nauja programa',
  pgNewTitle: 'Kam skirta nauja programa?',
  pgNewBody:
    'Programos rašomos kiekvienam klientui atskirai. Pasirinkite klientą ir pradėkite nuo šablono arba kitos dienos.',
  pgNewLabel: 'Pasirinkite klientą naujai programai',
  pgClientsLine: (n, names) => `${clientN(n)}: ${names}`,
  pgNamesMore: (names, more) => `${names} +${more}`,
  pgFollow: (n) =>
    plural('lt', n, {
      one: 'Šią programą vykdo {n} klientas.',
      few: 'Šią programą vykdo {n} klientai.',
      many: 'Šią programą vykdo {n} kliento.',
      other: 'Šią programą vykdo {n} klientų.',
    }),
  pgClientsLabel: 'Šios programos klientai',
  pgWeekWith: (week, days) => `${week} savaitė · su treneriu ${days}`,
  pgWeekSolo: (week) => `${week} savaitė · savarankiškai`,
  pgOpenEditor: 'Atidaryti redaktoriuje',
  pgOpenFor: (name) => `Atidaryti redaktoriuje: ${name}`,
  pgSharedTitle: 'Bendra programa',
  pgKeeps: (names, v) => `${names}: lieka v${v} versija, kol nukopijuosite naujesnę.`,
  pgBack: 'Programos',
  pgNoneH: 'Programų dar nėra',
  pgNoneB: 'Sukurkite programą arba nukopijuokite šabloną.',
  pgNoMatchH: 'Nieko nerasta',
  pgNoMatchB: 'Pabandykite kitą žodį arba išvalykite paiešką.',
  pgFailTitle: 'Programų nepavyko įkelti',
  pgFailBody: 'Patikrinkite ryšį ir bandykite dar kartą.',
  pgRetry: 'Bandyti dar kartą',
};
