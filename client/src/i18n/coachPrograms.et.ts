import { plural } from './coachPlural';
import type { ProgramsStrings } from './coachPrograms.en';

const progN = (n: number) => plural('et', n, { one: '{n} programm', other: '{n} programmi' });
const clientN = (n: number) => plural('et', n, { one: '{n} klient', other: '{n} klienti' });

export const programsEt: ProgramsStrings = {
  pgTitle: 'Programmid',
  pgSubtitle: (programs, clients) => `${progN(programs)}, ${clientN(clients)}`,
  pgListLabel: 'Programmid',
  pgSearch: 'Otsi programme',
  pgSearchClear: 'Tühjenda otsing',
  pgNew: 'Uus programm',
  pgNewTitle: 'Kellele uus programm on?',
  pgNewBody:
    'Programmid tehakse iga kliendi jaoks eraldi. Vali klient ja alusta mallist või teisest päevast.',
  pgNewLabel: 'Vali klient uuele programmile',
  pgClientsLine: (n, names) => `${clientN(n)}: ${names}`,
  pgNamesMore: (names, more) => `${names} +${more}`,
  pgFollow: (n) =>
    plural('et', n, {
      one: 'Seda programmi järgib {n} klient.',
      other: 'Seda programmi järgib {n} klienti.',
    }),
  pgClientsLabel: 'Selle programmi kliendid',
  pgWeekWith: (week, days) => `${week}. nädal · treeneriga ${days}`,
  pgWeekSolo: (week) => `${week}. nädal · iseseisvalt`,
  pgOpenEditor: 'Ava redaktoris',
  pgOpenFor: (name) => `Ava redaktoris: ${name}`,
  pgSharedTitle: 'Ühine programm',
  pgKeeps: (names, v) => `${names}: jääb versioon v${v}, kuni kopeerid uuema.`,
  pgBack: 'Programmid',
  pgNoneH: 'Programme pole veel',
  pgNoneB: 'Loo programm või kopeeri mall.',
  pgNoMatchH: 'Midagi ei leitud',
  pgNoMatchB: 'Proovi teist sõna või tühjenda otsing.',
  pgFailTitle: 'Programme ei õnnestunud laadida',
  pgFailBody: 'Kontrolli ühendust ja proovi uuesti.',
  pgRetry: 'Proovi uuesti',
};
