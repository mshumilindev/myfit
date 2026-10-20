/** Coach strings (Estonian). See `coach.en.ts`. */
import type { coachEn } from './coach.en';
import { plural } from './coachPlural';

const unread = (n: number) => plural('et', n, { one: '{n} lugemata', other: '{n} lugemata' });

export const coachEt: typeof coachEn = {
  navAgenda: 'Päevakava',
  navClients: 'Kliendid',
  navSchedule: 'Ajakava',
  navWeek: 'Nädal',
  navDecisions: 'Otsused',
  navPrograms: 'Programmid',
  navChat: 'Vestlus',
  navTeam: 'Meeskond',
  navMore: 'Rohkem',
  navLandmark: 'Treeneri navigatsioon',
  skipToContent: 'Mine sisu juurde',
  navLive: 'Otse',
  navSignals: 'Signaalid',
  navApps: 'Rakendused',

  // Shell (M0)
  shellDesc: 'Kliendid, programmid ja ajakava',
  modeNote:
    'Sinu enda treeningud jäävad privaatseks. Kui avad kliendi andmed, näeb klient, et sa neid vaatasid.',
  roleTrainer: 'Treener',
  roleAdmin: 'Administraator',
  moreProfile: 'Profiil',
  emptyTitle: 'Siin pole veel midagi',
  emptyBody: 'See vaade on valmimisel.',
  screenFailedTitle: 'See vaade ei avanenud',
  screenFailedBody: 'Midagi ei muudetud. Ülejäänud töölaud töötab.',
  screenFailedRetry: 'Proovi uuesti',
  clientTitle: 'Klient',
  backToClients: 'Kõik kliendid',
  drawerClose: 'Sulge',

  modeCoach: 'Treener',
  modeMyWorkouts: 'Minu treeningud',
  modeLabel: 'Režiim',
  railProfile: 'Profiil ja režiim',
  railNotifications: 'Teavitused',

  unread,
  railLive: (n) => plural('et', n, { one: '{n} treenib', other: '{n} treenivad' }),
  navWithUnread: (label, n) => `${label}, ${unread(n)}`,
};
