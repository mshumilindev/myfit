/** Teksty zespołu Coach (polski). Zob. `coachTeam.en.ts`. Bez „ona/on”: w tekstach imię osoby. */
import type { teamEn } from './coachTeam.en';
import { plural } from './coachPlural';

const peopleN = (n: number) =>
  plural('pl', n, { one: '{n} osoba', few: '{n} osoby', many: '{n} osób', other: '{n} osoby' });
const daysAgo = (n: number) =>
  plural('pl', n, {
    one: '{n} dzień temu',
    few: '{n} dni temu',
    many: '{n} dni temu',
    other: '{n} dnia temu',
  });

export const teamPl: typeof teamEn = {
  tmTitle: 'Zespół',
  tmSubTrainer: (n) => `${peopleN(n)}. Ty dodajesz menedżerów, menedżer dodaje trenerów.`,
  tmSubManager: (n) => `${peopleN(n)}. Ty dodajesz trenerów. Menedżera może usunąć tylko trener.`,
  tmAddManager: 'Dodaj menedżera',
  tmAddTrainer: 'Dodaj trenera',
  tmMembers: 'Członkowie',
  tmPending: 'Oczekujące zaproszenia',
  tmYou: 'Ty',
  tmRoleTrainer: 'Trener',
  tmRoleManager: 'Menedżer',
  tmPendingTag: 'Oczekuje',
  tmRevoke: 'Cofnij',
  tmRevokeFor: (email) => `Cofnij zaproszenie dla ${email}`,
  tmActiveNow: 'Aktywny teraz',
  tmLastActive: (when) => `Ostatnia aktywność: ${when}`,
  tmAdded: (date) => `Dodano ${date}`,
  tmWhenToday: 'dziś',
  tmWhenYesterday: 'wczoraj',
  tmInviteSent: (role, ago) => `${role}: zaproszenie wysłano ${ago}`,
  tmAgoToday: 'dziś',
  tmAgoYesterday: 'wczoraj',
  tmAgoDays: (n) => daysAgo(n),
  tmActivityLog: 'Dziennik aktywności',
  tmActivityLogSub: 'Kto co zrobił, dzień po dniu',
  tmRoles: 'Co może każda rola',
  tmRolesSub: 'Stały dostęp, taki sam dla wszystkich',
  tmLeave: 'Opuść zespół',
  tmLeaveNoteTrainer:
    'Menedżerowie stracą dostęp do Twoich klientów. Twoi klienci i dane zostają z Tobą.',
  tmLeaveNoteManager: 'Klienci i dane zostają bez zmian. Możesz zostać zaproszony ponownie.',
  tmOpenMember: (name) => `Otwórz: ${name}`,
  tmMembersLabel: 'Członkowie zespołu',
  tmPendingLabel: 'Oczekujące zaproszenia',

  tmAddManagerTitle: 'Dodaj menedżera',
  tmAddManagerBody:
    'Menedżer prowadzi Twój grafik i listę klientów. Nie widzi treningów, zdrowia, żywienia, notatek ani czatu i nie może dodawać innych menedżerów.',
  tmAddTrainerTitle: 'Dodaj trenera',
  tmAddTrainerBody:
    'Trener prowadzi własnych klientów. Dołącza do zespołu, którym zarządzasz, i pojawia się w Twoich Klientach i Grafiku.',
  tmEmail: 'Email',
  tmEmailHint:
    'Osoba dostanie link z zaproszeniem e-mailem. Działa 7 dni i dla jednej osoby. Dostęp zaczyna się po przyjęciu.',
  tmSendInvite: 'Wyślij zaproszenie',
  tmCancel: 'Anuluj',
  tmErrInvalidEmail: 'Podaj poprawny adres e-mail.',
  tmErrExists: 'Ta osoba jest już w zespole lub ma otwarte zaproszenie.',
  tmErrOffline: 'Brak sieci. Spróbuj ponownie po odzyskaniu połączenia.',
  tmErrGeneric: 'Nie udało się wysłać zaproszenia. Spróbuj ponownie.',
  tmInviteSentSnack: (email) => `Zaproszenie wysłano: ${email}`,
  tmLinkTitle: 'Udostępnij link z zaproszeniem',
  tmLinkBody: (email) => `Wyślij ten link: ${email}. Działa jeden raz i wygasa po 7 dniach.`,
  tmCopyLink: 'Kopiuj link',
  tmLinkCopied: 'Link skopiowany',
  tmDone: 'Gotowe',

  tmMemberTitle: 'Członek zespołu',
  tmRole: 'Rola',
  tmEmailRow: 'Email',
  tmAddedRow: 'Dodano',
  tmLastActiveRow: 'Ostatnia aktywność',
  tmScheduleAccess: 'Dostęp do grafiku',
  tmScheduleReady: (ready, total) => `Gotowe: ${ready} z ${total} klientów`,
  tmPermissions: 'Uprawnienia',
  tmSeeAll: 'Widzi całą aktywność zespołu',
  tmSeeAllOff: (name) =>
    `Wyłączone: ${name} widzi w dzienniku tylko własne działania. Włączone: ${name} widzi działania wszystkich trenerów i menedżerów.`,
  tmRemoveFromTeam: 'Usuń z zespołu',
  tmRemoveNote: (name) =>
    `${name} traci dostęp natychmiast. Wcześniejsze działania zostają w dzienniku.`,
  tmClose: 'Zamknij',

  tmRemoveTitle: (name) => `Usunąć ${name} z zespołu?`,
  tmRemoveBody: (name) => `${name} straci dostęp do Twoich klientów i grafiku.`,
  tmRemoveEffect1: 'Dostęp kończy się natychmiast na każdym urządzeniu.',
  tmRemoveEffect2: (name) => `Klucze sesji są odnawiane, by ${name} nie czytał(a) nowych danych.`,
  tmRemoveEffect3: 'Wcześniejsze działania zostają w dzienniku aktywności.',
  tmRemoveKeep: (name) => `Zostaw: ${name}`,
  tmRemoveConfirm: 'Usuń',
  tmLeaveManagerTitle: (owner) => `Opuścić zespół: ${owner}?`,
  tmLeaveManagerBody: 'Stracisz dostęp do grafiku i klientów.',
  tmLeaveManagerEffect1: 'Klienci i sesje zostają przy swoich trenerach.',
  tmLeaveManagerEffect2: 'Trener może zaprosić Cię ponownie.',
  tmLeaveManagerEffect3: 'Twoje wcześniejsze działania zostają w dzienniku aktywności.',
  tmLeaveStay: 'Zostań',
  tmLeaveConfirm: 'Opuść zespół',
  tmLeaveTrainerTitle: 'Opuścić zespół?',
  tmLeaveTrainerBody: 'Menedżerowie stracą dostęp do Twoich klientów.',
  tmLeaveTrainerEffect1: 'Twoi klienci i dane zostają z Tobą.',
  tmLeaveTrainerEffect2: 'Klucze sesji Twoich klientów są odnawiane.',
  tmLeaveTrainerEffect3: 'Możesz zostać zaproszony ponownie.',

  tmLoadFailed: 'Nie udało się wczytać zespołu.',
  tmRetry: 'Spróbuj ponownie',
  tmOfflineStale: 'Brak sieci. Pokazano ostatnio zapisany zespół.',
  tmEmptyMembers: 'Na razie tylko Ty.',
  tmEmptyInvites: 'Brak otwartych zaproszeń.',
};
