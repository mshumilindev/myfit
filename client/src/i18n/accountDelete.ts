import { useT, type LocaleId } from './index';

/**
 * Words of the account deletion flow (SPO-285; designs DelAcct1-3, SPO-295): three prompts, then the password step-up
 * (the existing ReauthDialog, words in `coachSafe`). English, Ukrainian and Polish; Lithuanian and Estonian read the
 * English text like the legal gate strings. uk/pl are machine translations that need a native read before launch.
 */
export interface DeleteAccountStrings {
  /** the link on the legal gate */
  deleteMyAccount: string;
  /** the row in Your privacy */
  rowLabel: string;
  rowSub: string;
  keep: string;
  progress: (i: number, n: number) => string;
  step1Title: string;
  step1Body: string;
  step1Copy: string;
  step1Confirm: string;
  step1Effects: readonly string[];
  step2Title: string;
  step2Body: string;
  step2Confirm: string;
  step2Effects: readonly string[];
  step3Title: string;
  step3Body: string;
  step3Type: string;
  step3Confirm: string;
}

const en: DeleteAccountStrings = {
  deleteMyAccount: 'Delete my account',
  rowLabel: 'Delete account',
  rowSub: 'Remove your account and all your data',
  keep: 'Keep my account',
  progress: (i, n) => `Step ${i} of ${n}`,
  step1Title: 'Delete your account?',
  step1Body: 'This removes your account and all your data from Spotter. It cannot be undone.',
  step1Copy:
    'You can download a copy of your data first. After the account is deleted it cannot be recovered.',
  step1Confirm: 'Continue',
  step1Effects: [
    'Workouts, programs and plans',
    'Health, body, sleep and nutrition entries',
    'Gyms, visits, messages and notes',
    'Your sign-in methods and devices',
  ],
  step2Title: 'What else changes',
  step2Body:
    'People you work with are told the relationship ended. Their own data stays with them.',
  step2Confirm: 'Continue',
  step2Effects: [
    'Your trainer no longer has you as a client; the conversation and shared notes are removed',
    'If you are a trainer: your clients are released and keep their own data',
    'If you own a team: the team is closed and its members keep their accounts',
    'Programs you created, and their assignments, disappear for the people who use them',
    'Anything on this device that has not synced yet is discarded',
  ],
  step3Title: 'Last step',
  step3Body: 'Type DELETE to confirm.',
  step3Type: 'Type DELETE',
  step3Confirm: 'Delete account',
};

const uk: DeleteAccountStrings = {
  deleteMyAccount: 'Видалити мій акаунт',
  rowLabel: 'Видалити акаунт',
  rowSub: 'Видалити акаунт і всі ваші дані',
  keep: 'Залишити акаунт',
  progress: (i, n) => `Крок ${i} з ${n}`,
  step1Title: 'Видалити акаунт?',
  step1Body: 'Це видалить ваш акаунт і всі ваші дані зі Spotter. Це неможливо скасувати.',
  step1Copy:
    'Ви можете спершу завантажити копію своїх даних. Після видалення акаунта відновити їх неможливо.',
  step1Confirm: 'Далі',
  step1Effects: [
    'Тренування, програми й плани',
    'Записи про здоров’я, тіло, сон і харчування',
    'Зали, відвідування, повідомлення й нотатки',
    'Ваші способи входу й пристрої',
  ],
  step2Title: 'Що ще зміниться',
  step2Body:
    'Людей, з якими ви працюєте, сповістять, що співпрацю завершено. Їхні власні дані лишаються в них.',
  step2Confirm: 'Далі',
  step2Effects: [
    'Тренер більше не має вас клієнтом; розмова й спільні нотатки видаляються',
    'Якщо ви тренер: ваші клієнти звільняються й зберігають свої дані',
    'Якщо ви власник команди: команду закрито, її учасники зберігають акаунти',
    'Програми, які ви створили, і їхні призначення зникнуть у людей, які ними користуються',
    'Усе, що на цьому пристрої ще не синхронізовано, буде втрачено',
  ],
  step3Title: 'Останній крок',
  step3Body: 'Введіть DELETE для підтвердження.',
  step3Type: 'Введіть DELETE',
  step3Confirm: 'Видалити акаунт',
};

const pl: DeleteAccountStrings = {
  deleteMyAccount: 'Usuń moje konto',
  rowLabel: 'Usuń konto',
  rowSub: 'Usuń konto i wszystkie swoje dane',
  keep: 'Zachowaj konto',
  progress: (i, n) => `Krok ${i} z ${n}`,
  step1Title: 'Usunąć konto?',
  step1Body: 'To usuwa Twoje konto i wszystkie Twoje dane ze Spottera. Nie można tego cofnąć.',
  step1Copy:
    'Możesz najpierw pobrać kopię swoich danych. Po usunięciu konta nie da się ich odzyskać.',
  step1Confirm: 'Dalej',
  step1Effects: [
    'Treningi, programy i plany',
    'Wpisy o zdrowiu, ciele, śnie i odżywianiu',
    'Siłownie, wizyty, wiadomości i notatki',
    'Twoje metody logowania i urządzenia',
  ],
  step2Title: 'Co jeszcze się zmieni',
  step2Body:
    'Osoby, z którymi pracujesz, dostaną informację o zakończeniu współpracy. Ich własne dane zostają u nich.',
  step2Confirm: 'Dalej',
  step2Effects: [
    'Trener nie ma już Ciebie jako klienta; rozmowa i wspólne notatki są usuwane',
    'Jeśli jesteś trenerem: Twoi klienci zostają zwolnieni i zachowują własne dane',
    'Jeśli jesteś właścicielem zespołu: zespół zostaje zamknięty, a jego członkowie zachowują konta',
    'Programy utworzone przez Ciebie i ich przypisania znikną u osób, które z nich korzystają',
    'Wszystko na tym urządzeniu, co jeszcze się nie zsynchronizowało, zostanie utracone',
  ],
  step3Title: 'Ostatni krok',
  step3Body: 'Wpisz DELETE, aby potwierdzić.',
  step3Type: 'Wpisz DELETE',
  step3Confirm: 'Usuń konto',
};

export const DELETE_ACCOUNT_LOCALES: Partial<Record<LocaleId, DeleteAccountStrings>> = {
  en,
  uk,
  pl,
};

export const deleteAccountTexts = (locale: LocaleId): DeleteAccountStrings =>
  DELETE_ACCOUNT_LOCALES[locale] ?? en;

export function useDeleteT(): DeleteAccountStrings {
  return deleteAccountTexts(useT().locale);
}
