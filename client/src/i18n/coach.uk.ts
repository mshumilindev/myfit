/** Coach strings (Ukrainian). See `coach.en.ts`. */
import type { coachEn } from './coach.en';
import { plural } from './coachPlural';

const unread = (n: number) =>
  plural('uk', n, {
    one: '{n} непрочитане',
    few: '{n} непрочитані',
    many: '{n} непрочитаних',
    other: '{n} непрочитаних',
  });

export const coachUk: typeof coachEn = {
  navAgenda: 'Агенда',
  navClients: 'Клієнти',
  navSchedule: 'Розклад',
  navWeek: 'Тиждень',
  navDecisions: 'Рішення',
  navPrograms: 'Програми',
  navChat: 'Чат',
  navTeam: 'Команда',
  navMore: 'Ще',
  navLandmark: 'Навігація тренера',
  skipToContent: 'До вмісту',
  navLive: 'Наживо',
  navSignals: 'Сигнали',
  navApps: 'Застосунки',

  // Shell (M0)
  shellDesc: 'Клієнти, програми та розклад',
  modeNote:
    'Ваші власні тренування лишаються приватними. Коли ви відкриваєте дані клієнта, клієнт бачить, що ви їх переглянули.',
  roleTrainer: 'Тренер',
  roleAdmin: 'Адміністратор',
  moreProfile: 'Профіль',
  emptyTitle: 'Тут поки порожньо',
  emptyBody: 'Цей екран ще в розробці.',
  screenFailedTitle: 'Цей екран не відкрився',
  screenFailedBody: 'Нічого не змінено. Решта панелі працює.',
  screenFailedRetry: 'Спробувати ще раз',
  clientTitle: 'Клієнт',
  backToClients: 'Усі клієнти',
  drawerClose: 'Закрити',

  modeCoach: 'Тренер',
  modeMyWorkouts: 'Мої тренування',
  modeLabel: 'Режим',
  railProfile: 'Профіль і режим',
  railNotifications: 'Сповіщення',

  unread,
  railLive: (n) =>
    plural('uk', n, {
      one: '{n} тренується',
      few: '{n} тренуються',
      many: '{n} тренуються',
      other: '{n} тренуються',
    }),
  navWithUnread: (label, n) => `${label}, ${unread(n)}`,
};
