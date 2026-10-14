/** Coach strings (Lithuanian). See `coach.en.ts`. */
import type { coachEn } from './coach.en';
import { plural } from './coachPlural';

const unread = (n: number) =>
  plural('lt', n, {
    one: '{n} neperskaityta',
    few: '{n} neperskaitytos',
    many: '{n} neperskaityto',
    other: '{n} neperskaitytų',
  });

export const coachLt: typeof coachEn = {
  navAgenda: 'Darbotvarkė',
  navClients: 'Klientai',
  navSchedule: 'Tvarkaraštis',
  navWeek: 'Savaitė',
  navDecisions: 'Sprendimai',
  navPrograms: 'Programos',
  navChat: 'Pokalbiai',
  navMore: 'Daugiau',
  navLandmark: 'Trenerio navigacija',
  skipToContent: 'Pereiti prie turinio',
  navLive: 'Gyvai',
  navSignals: 'Signalai',
  navApps: 'Programos',

  // Shell (M0)
  shellDesc: 'Klientai, programos ir tvarkaraštis',
  modeNote:
    'Jūsų pačių treniruotės lieka privačios. Kai atidarote kliento duomenis, klientas mato, kad juos peržiūrėjote.',
  roleTrainer: 'Treneris',
  roleAdmin: 'Administratorius',
  moreProfile: 'Profilis',
  emptyTitle: 'Kol kas tuščia',
  emptyBody: 'Šis ekranas dar kuriamas.',
  screenFailedTitle: 'Šis ekranas neatsidarė',
  screenFailedBody: 'Nieko nepakeista. Likusi skydelio dalis veikia.',
  screenFailedRetry: 'Bandyti dar kartą',
  clientTitle: 'Klientas',
  backToClients: 'Visi klientai',
  drawerClose: 'Uždaryti',

  modeCoach: 'Treneris',
  modeMyWorkouts: 'Mano treniruotės',
  modeLabel: 'Režimas',
  railProfile: 'Profilis ir režimas',
  railNotifications: 'Pranešimai',

  unread,
  railLive: (n) =>
    plural('lt', n, {
      one: '{n} treniruojasi',
      few: '{n} treniruojasi',
      many: '{n} treniruojasi',
      other: '{n} treniruojasi',
    }),
  navWithUnread: (label, n) => `${label}, ${unread(n)}`,
};
