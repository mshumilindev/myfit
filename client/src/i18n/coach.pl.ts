/** Coach strings (Polish). See `coach.en.ts`. */
import type { coachEn } from './coach.en';
import { plural } from './coachPlural';

const unread = (n: number) =>
  plural('pl', n, {
    one: '{n} nieprzeczytana',
    few: '{n} nieprzeczytane',
    many: '{n} nieprzeczytanych',
    other: '{n} nieprzeczytanych',
  });

export const coachPl: typeof coachEn = {
  navAgenda: 'Agenda',
  navClients: 'Klienci',
  navSchedule: 'Harmonogram',
  navWeek: 'Tydzień',
  navDecisions: 'Decyzje',
  navPrograms: 'Programy',
  navChat: 'Czat',
  navMore: 'Więcej',
  navLandmark: 'Nawigacja trenera',
  skipToContent: 'Przejdź do treści',
  navLive: 'Na żywo',
  navSignals: 'Sygnały',
  navApps: 'Aplikacje',

  // Shell (M0)
  shellDesc: 'Klienci, programy i harmonogram',
  modeNote:
    'Twoje własne treningi pozostają prywatne. Gdy otwierasz dane klienta, klient widzi, że dane zostały otwarte.',
  roleTrainer: 'Trener',
  roleAdmin: 'Administrator',
  moreProfile: 'Profil',
  emptyTitle: 'Na razie pusto',
  emptyBody: 'Ten ekran jest w przygotowaniu.',
  screenFailedTitle: 'Ten ekran się nie otworzył',
  screenFailedBody: 'Nic nie zostało zmienione. Reszta panelu działa.',
  screenFailedRetry: 'Spróbuj ponownie',
  clientTitle: 'Klient',
  backToClients: 'Wszyscy klienci',
  drawerClose: 'Zamknij',

  modeCoach: 'Trener',
  modeMyWorkouts: 'Moje treningi',
  modeLabel: 'Tryb',
  railProfile: 'Profil i tryb',
  railNotifications: 'Powiadomienia',

  unread,
  railLive: (n) =>
    plural('pl', n, {
      one: '{n} trenuje',
      few: '{n} trenują',
      many: '{n} trenuje',
      other: '{n} trenuje',
    }),
  navWithUnread: (label, n) => `${label}, ${unread(n)}`,
};
