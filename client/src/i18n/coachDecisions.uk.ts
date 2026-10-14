/** Coach Decisions strings (Ukrainian). See `coachDecisions.en.ts`. */
import type { decisionsEn } from './coachDecisions.en';
import { plural } from './coachPlural';

const decN = (n: number) =>
  plural('uk', n, {
    one: '{n} рішення',
    few: '{n} рішення',
    many: '{n} рішень',
    other: '{n} рішень',
  });

export const decisionsUk: typeof decisionsEn = {
  dcTitle: 'Рішення',
  dcGroupBy: 'Групувати за',
  dcGroupNone: 'Без групування',
  dcGroupClient: 'Клієнтом',
  dcGroupResult: 'Результатом',
  dcGroupTrigger: 'Тригером',
  dcGroupMonth: 'Місяцем',
  dcGrouped: 'Групування',
  dcCount: decN,
  dcBig: (improved, total) => `${improved} із ${total}`,
  dcBigRest: (pct) => `рішень дали покращення (${pct}%)`,
  dcHistory: 'Історія',
  dcSearch: 'Шукати рішення',
  dcClearSearch: 'Очистити пошук',
  dcFilterLabel: 'Показати рішення',
  dcAll: 'Усі',
  dcExport: 'Експорт',
  dcExportSoon: 'Експорт з’явиться з наступним оновленням',
  dcEmptyH: 'Рішень ще немає',
  dcEmptyBody: 'Коли ви ухвалите рішення за сигналом, воно збережеться тут разом з результатом.',
  dcToAgenda: 'До «Агенди»',
  dcNoMatch: 'Немає відповідних рішень',
  dcClear: 'Скинути фільтри',
  dcOpen: (name) => `Відкрити: ${name}`,
  dcList: 'Список рішень',
  dcMore: (n, left) => `Показати ще ${n} · залишилось ${left}`,
  dcLoading: 'Завантажуємо рішення',
  dcWaiting: 'Очікує',
  dcFailTitle: 'Не вдалося завантажити рішення',
  dcFailBody: 'Перевірте з’єднання та спробуйте ще раз.',
  dcTryAgain: 'Спробувати ще раз',
};
