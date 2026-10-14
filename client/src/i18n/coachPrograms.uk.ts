import { plural } from './coachPlural';
import type { ProgramsStrings } from './coachPrograms.en';

const progN = (n: number) =>
  plural('uk', n, {
    one: '{n} програма',
    few: '{n} програми',
    many: '{n} програм',
    other: '{n} програми',
  });
const clientN = (n: number) =>
  plural('uk', n, {
    one: '{n} клієнт',
    few: '{n} клієнти',
    many: '{n} клієнтів',
    other: '{n} клієнта',
  });

export const programsUk: ProgramsStrings = {
  pgTitle: 'Програми',
  pgSubtitle: (programs, clients) => `${progN(programs)}, ${clientN(clients)}`,
  pgListLabel: 'Програми',
  pgSearch: 'Пошук програм',
  pgSearchClear: 'Очистити пошук',
  pgNew: 'Нова програма',
  pgNewTitle: 'Для кого нова програма?',
  pgNewBody:
    'Програми пишуться для кожного клієнта окремо. Оберіть клієнта й почніть із шаблону або з іншого дня.',
  pgNewLabel: 'Оберіть клієнта для нової програми',
  pgClientsLine: (n, names) => `${clientN(n)}: ${names}`,
  pgNamesMore: (names, more) => `${names} +${more}`,
  pgFollow: (n) =>
    plural('uk', n, {
      one: 'За цією програмою тренується {n} клієнт.',
      few: 'За цією програмою тренуються {n} клієнти.',
      many: 'За цією програмою тренуються {n} клієнтів.',
      other: 'За цією програмою тренуються {n} клієнта.',
    }),
  pgClientsLabel: 'Клієнти цієї програми',
  pgWeekSolo: (week) => `Тиждень ${week} · самостійно`,
  pgWeekWith: (week, days) => `Тиждень ${week} · з тренером ${days}`,
  pgOpenEditor: 'Відкрити в редакторі',
  pgOpenFor: (name) => `Відкрити в редакторі: ${name}`,
  pgSharedTitle: 'Спільна програма',
  pgKeeps: (names, v) => `${names}: залишається версія v${v}, доки ви не скопіюєте новішу.`,
  pgBack: 'Програми',
  pgNoneH: 'Програм ще немає',
  pgNoneB: 'Створіть програму або скопіюйте шаблон.',
  pgNoMatchH: 'Нічого не знайдено',
  pgNoMatchB: 'Спробуйте інше слово або очистіть пошук.',
  pgFailTitle: 'Програми не завантажилися',
  pgFailBody: 'Перевірте зʼєднання й спробуйте ще раз.',
  pgRetry: 'Спробувати ще раз',
};
