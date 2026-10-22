import { useT, type LocaleId } from './index';
import type { HealthFeature } from '../legal/consents';

/**
 * Words of the per-feature health consent (SPO-290): the prompt shown before the FIRST use of a health feature, the
 * "X is off" state, the withdraw and delete dialogs, and the "not medical advice" notice (N9). English, Ukrainian and
 * Polish; Lithuanian and Estonian read the English text like the legal gate. uk/pl are machine translations that need a
 * native read before launch (`legal/pending.ts`). The wording follows the approved lab design, and says only what the code
 * does: the key of the sealed collections is issued by our server (`functions/src/vault.ts`), so this is storage
 * protection and never "end-to-end"; the food log (nutrition) is not sealed by Spotter at all, and the text says so.
 */
export interface HealthFeatureWords {
  /** The prompt title ("Track nicotine?"). */
  title: string;
  /** Name inside a sentence ("nicotine tracking"). */
  name: string;
  /** What the person adds, for the "What you add" row. */
  what: string;
  /** Who can see it: the trainer sentence differs (the cycle is never shared). */
  who: string;
  /** The trainer part of "If you withdraw". */
  coach: string;
  /**
   * Injuries and long-term conditions only ('' elsewhere): saved safety limits keep applying when the feature is off. They
   * only ever restrict training, are never shown, shared or sent anywhere, and go when the entries are deleted.
   */
  limits: string;
}

/** The "If you withdraw" sentence of a feature: its trainer part, then the safety-limits part when it has one. */
export const withdrawNote = (w: HealthFeatureWords): string =>
  [w.coach, w.limits].filter(Boolean).join(' ');

export interface HealthConsentStrings {
  lead: string;
  factsLabel: string;
  whatLabel: string;
  whereLabel: string;
  /** Sealed collections: injuries, conditions, cycle, nicotine, alcohol, supplements. */
  where: string;
  /** The food log. */
  whereNutrition: string;
  whoLabel: string;
  withdrawLabel: string;
  /** `coach` = the feature's own coach sentence. */
  withdraw: (coach: string) => string;
  outsideLabel: string;
  outsideNutrition: string;
  primary: string;
  secondary: string;
  close: string;
  privacy: string;
  version: (v: string) => string;
  saveError: string;
  features: Record<HealthFeature, HealthFeatureWords>;
  /** "Nicotine is off" state. */
  offTitle: (feature: string) => string;
  offBody: string;
  turnOn: string;
  /** Withdraw dialog. */
  wTitle: (name: string) => string;
  wBody: (coach: string) => string;
  wConfirm: string;
  wKeep: string;
  wFailed: string;
  /** Delete offer after withdrawing: step 1, step 2, labels. */
  d1Title: (feature: string) => string;
  d1Body: string;
  d1Confirm: string;
  /** Added to the delete offer of a feature that has `limits`. */
  d1Limits: string;
  d2Title: string;
  d2Body: string;
  d2Confirm: string;
  dKeep: string;
  dProgress: (i: number, n: number) => string;
  dFailed: string;
  /** "Not medical advice" (N9). */
  disclaimer: string;
}

const en: HealthConsentStrings = {
  lead: 'This is health data, so Spotter asks for your explicit consent before you start. It is for this feature only.',
  factsLabel: 'Details',
  whatLabel: 'What you add',
  whereLabel: 'Where it lives',
  where:
    'In your account, stored encrypted. Our servers hold the key your device uses, so this is protection in storage, not end-to-end encryption.',
  whereNutrition:
    'In your account on Google’s servers (Firebase). Unlike your other health data, Spotter does not add its own encryption to food entries yet. It is not end-to-end encryption.',
  whoLabel: 'Who can see it',
  withdrawLabel: 'If you withdraw',
  withdraw: (coach) =>
    `The feature turns off. Your entries stay in your account, unused, until you delete them. ${coach}`,
  outsideLabel: 'Outside services',
  outsideNutrition:
    'When you search for a food, the words you type go to Open Food Facts, which also sees your IP address.',
  primary: 'I agree',
  secondary: 'Not now',
  close: 'Close',
  privacy: 'Privacy Policy',
  version: (v) => `version ${v}`,
  saveError: 'Could not save your choice. Please try again.',
  features: {
    injuries: {
      title: 'Track injuries?',
      name: 'injury tracking',
      what: 'The injuries you log: body part, side, dates, rehab check-ins and notes. This is health data.',
      who: 'In the app, only you. Your trainer sees it only if you share it in Privacy and sharing.',
      coach:
        'Your trainer’s access to your injuries is switched off too. This needs a connection; if it does not go through, turn it off in your trainer sharing settings.',
      limits:
        'Safety limits you already saved, such as an injury that needs rest, keep protecting your training and streak. They only ever reduce load, and are never shown, shared or sent anywhere.',
    },
    chronic: {
      title: 'Add long-term conditions?',
      name: 'long-term conditions',
      what: 'The long-term conditions you pick, how severe they are and from when. This is health data.',
      who: 'In the app, only you. Your trainer sees a condition only if you share it.',
      coach: 'What your trainer saw of them is removed.',
      limits:
        'Safety limits you already saved, such as a pregnancy or a limiting condition, keep protecting your training and keep the Cycle paused. They only ever reduce load, and are never shown, shared or sent anywhere.',
    },
    cycle: {
      title: 'Track your cycle?',
      name: 'cycle tracking',
      what: 'Your typical cycle and period length and your start dates. This is health data.',
      who: 'In the app, only you. It is never shared with your trainer.',
      coach: 'It was never shared with your trainer.',
      limits: '',
    },
    nicotine: {
      title: 'Track nicotine?',
      name: 'nicotine tracking',
      what: 'The products you use and the usual amounts you enter. This is health data.',
      who: 'In the app, only you. Your trainer sees it only if you share it in Privacy and sharing.',
      coach: 'What your trainer saw of it is removed.',
      limits: '',
    },
    alcohol: {
      title: 'Track alcohol?',
      name: 'alcohol tracking',
      what: 'The drinks and usual servings you enter, and your day check-ins. This is health data.',
      who: 'In the app, only you. Your trainer sees it only if you share it in Privacy and sharing.',
      coach: 'What your trainer saw of it is removed.',
      limits: '',
    },
    supplements: {
      title: 'Track supplements?',
      name: 'supplement tracking',
      what: 'The supplements you take, their dose and timing, and your day check-ins. This is health data.',
      who: 'In the app, only you. Your trainer sees it only if you share it in Privacy and sharing.',
      coach: 'What your trainer saw of it is removed.',
      limits: '',
    },
    nutrition: {
      title: 'Track nutrition?',
      name: 'nutrition tracking',
      what: 'The meals and foods you log with calories and macros, your goal and your nutrition profile. This is health data.',
      who: 'In the app, only you. Your trainer sees it only if you share it in Privacy and sharing.',
      coach:
        'Your trainer’s access to your food log is switched off too. This needs a connection; if it does not go through, turn it off in your trainer sharing settings.',
      limits: '',
    },
  },
  offTitle: (f) => `${f} is off`,
  offBody:
    'Spotter collects and shows nothing for this feature until you agree. The rest of Spotter works as usual.',
  turnOn: 'Turn on',
  wTitle: (n) => `Turn off ${n}?`,
  wBody: (coach) =>
    `The feature stops. ${coach} Entries you made stay in your account, unused, until you delete them. The rest of Spotter keeps working.`,
  wConfirm: 'Withdraw consent',
  wKeep: 'Keep it on',
  wFailed:
    'The feature is off on this device, but the withdrawal could not be saved. Try again when you are online.',
  d1Title: (f) => `Delete your ${f} data?`,
  d1Body:
    'Your entries for this feature are removed from your account and from this device. You can also leave them and delete them later.',
  d1Confirm: 'Continue',
  d1Limits: 'Deleting also removes those safety limits, so they stop applying.',
  d2Title: 'This cannot be undone',
  d2Body: 'Deleted entries cannot be restored.',
  d2Confirm: 'Delete',
  dKeep: 'Keep my data',
  dProgress: (i, n) => `Step ${i} of ${n}`,
  dFailed: 'Could not delete the data. Please try again.',
  disclaimer:
    'Spotter gives general fitness information, not medical advice. Talk to a professional if you have an injury or condition.',
};

const uk: HealthConsentStrings = {
  lead: 'Це дані про здоров’я, тому Spotter просить вашу явну згоду, перш ніж ви почнете. Вона діє лише для цієї функції.',
  factsLabel: 'Подробиці',
  whatLabel: 'Що ви додаєте',
  whereLabel: 'Де це зберігається',
  where:
    'У вашому акаунті, у зашифрованому вигляді. Наші сервери зберігають ключ, який використовує ваш пристрій, тож це захист під час зберігання, а не наскрізне шифрування.',
  whereNutrition:
    'У вашому акаунті на серверах Google (Firebase). На відміну від інших даних про здоров’я, Spotter поки що не додає власного шифрування до записів про їжу. Це не наскрізне шифрування.',
  whoLabel: 'Хто може це бачити',
  withdrawLabel: 'Якщо ви відкличете згоду',
  withdraw: (coach) =>
    `Функція вимикається. Ваші записи лишаються в акаунті невикористаними, доки ви їх не видалите. ${coach}`,
  outsideLabel: 'Зовнішні сервіси',
  outsideNutrition:
    'Коли ви шукаєте продукт, слова пошуку надсилаються до Open Food Facts, який також бачить вашу IP-адресу.',
  primary: 'Погоджуюсь',
  secondary: 'Не зараз',
  close: 'Закрити',
  privacy: 'Політика конфіденційності',
  version: (v) => `версія ${v}`,
  saveError: 'Не вдалося зберегти вибір. Спробуйте ще раз.',
  features: {
    injuries: {
      title: 'Вести облік травм?',
      name: 'облік травм',
      what: 'Травми, які ви записуєте: частина тіла, сторона, дати, відгуки після реабілітації та нотатки. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренер бачить це, лише якщо ви поділитеся в «Приватність і доступ».',
      coach:
        'Доступ тренера до ваших травм теж вимикається. Для цього потрібне з’єднання; якщо не вдалося, вимкніть його в налаштуваннях доступу тренера.',
      limits:
        'Обмеження безпеки, які ви вже зберегли, наприклад травма, що потребує відпочинку, і далі захищають ваші тренування та серію. Вони лише зменшують навантаження й ніколи не показуються, не передаються і нікуди не надсилаються.',
    },
    chronic: {
      title: 'Додати тривалі стани?',
      name: 'тривалі стани',
      what: 'Тривалі стани, які ви обираєте, їхня тяжкість і дата початку. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренер бачить стан, лише якщо ви ним поділитеся.',
      coach: 'Те, що тренер бачив про них, прибирається.',
      limits:
        'Обмеження безпеки, які ви вже зберегли, наприклад вагітність чи стан із обмеженнями, і далі захищають ваші тренування та тримають Цикл призупиненим. Вони лише зменшують навантаження й ніколи не показуються, не передаються і нікуди не надсилаються.',
    },
    cycle: {
      title: 'Вести облік циклу?',
      name: 'облік циклу',
      what: 'Ваша типова тривалість циклу та місячних і дати початку. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренеру це ніколи не надається.',
      coach: 'Тренеру це ніколи не надавалося.',
      limits: '',
    },
    nicotine: {
      title: 'Вести облік нікотину?',
      name: 'облік нікотину',
      what: 'Продукти, якими ви користуєтесь, і звичні кількості, які ви вводите. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренер бачить це, лише якщо ви поділитеся в «Приватність і доступ».',
      coach: 'Те, що тренер бачив про це, прибирається.',
      limits: '',
    },
    alcohol: {
      title: 'Вести облік алкоголю?',
      name: 'облік алкоголю',
      what: 'Напої та звичні порції, які ви вводите, і відмітки за дні. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренер бачить це, лише якщо ви поділитеся в «Приватність і доступ».',
      coach: 'Те, що тренер бачив про це, прибирається.',
      limits: '',
    },
    supplements: {
      title: 'Вести облік добавок?',
      name: 'облік добавок',
      what: 'Добавки, які ви приймаєте, їхня доза й час, і відмітки за дні. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренер бачить це, лише якщо ви поділитеся в «Приватність і доступ».',
      coach: 'Те, що тренер бачив про це, прибирається.',
      limits: '',
    },
    nutrition: {
      title: 'Вести облік харчування?',
      name: 'облік харчування',
      what: 'Страви й продукти, які ви записуєте, з калоріями та макроелементами, ваша ціль і профіль харчування. Це дані про здоров’я.',
      who: 'У застосунку лише ви. Тренер бачить це, лише якщо ви поділитеся в «Приватність і доступ».',
      coach:
        'Доступ тренера до вашого журналу харчування теж вимикається. Для цього потрібне з’єднання; якщо не вдалося, вимкніть його в налаштуваннях доступу тренера.',
      limits: '',
    },
  },
  offTitle: (f) => `${f}: вимкнено`,
  offBody:
    'Spotter нічого не збирає й не показує для цієї функції, доки ви не погодитесь. Решта Spotter працює як зазвичай.',
  turnOn: 'Увімкнути',
  wTitle: (n) => `Вимкнути: ${n}?`,
  wBody: (coach) =>
    `Функція зупиняється. ${coach} Ваші записи лишаються в акаунті невикористаними, доки ви їх не видалите. Решта Spotter працює.`,
  wConfirm: 'Відкликати згоду',
  wKeep: 'Залишити',
  wFailed:
    'На цьому пристрої функцію вимкнено, але відкликання не вдалося зберегти. Спробуйте ще раз, коли будете онлайн.',
  d1Title: (f) => `Видалити дані: ${f}?`,
  d1Body:
    'Ваші записи для цієї функції буде видалено з акаунта й з цього пристрою. Ви також можете їх залишити й видалити пізніше.',
  d1Confirm: 'Далі',
  d1Limits: 'Видалення також прибирає ці обмеження безпеки, тож вони перестануть діяти.',
  d2Title: 'Це неможливо скасувати',
  d2Body: 'Видалені записи не відновити.',
  d2Confirm: 'Видалити',
  dKeep: 'Залишити дані',
  dProgress: (i, n) => `Крок ${i} з ${n}`,
  dFailed: 'Не вдалося видалити дані. Спробуйте ще раз.',
  disclaimer:
    'Spotter дає загальну фітнес-інформацію, а не медичні поради. Якщо у вас травма чи захворювання, зверніться до фахівця.',
};

const pl: HealthConsentStrings = {
  lead: 'To dane o zdrowiu, więc Spotter prosi o Twoją wyraźną zgodę, zanim zaczniesz. Dotyczy tylko tej funkcji.',
  factsLabel: 'Szczegóły',
  whatLabel: 'Co dodajesz',
  whereLabel: 'Gdzie to jest',
  where:
    'Na Twoim koncie, zapisane w postaci zaszyfrowanej. Nasze serwery przechowują klucz używany przez Twoje urządzenie, więc to ochrona w zapisie, a nie szyfrowanie end-to-end.',
  whereNutrition:
    'Na Twoim koncie na serwerach Google (Firebase). W odróżnieniu od innych danych o zdrowiu Spotter nie dodaje jeszcze własnego szyfrowania do wpisów o jedzeniu. To nie jest szyfrowanie end-to-end.',
  whoLabel: 'Kto może to widzieć',
  withdrawLabel: 'Jeśli wycofasz zgodę',
  withdraw: (coach) =>
    `Funkcja się wyłącza. Twoje wpisy zostają na koncie, nieużywane, dopóki ich nie usuniesz. ${coach}`,
  outsideLabel: 'Usługi zewnętrzne',
  outsideNutrition:
    'Gdy szukasz produktu, wpisane słowa trafiają do Open Food Facts, który widzi też Twój adres IP.',
  primary: 'Zgadzam się',
  secondary: 'Nie teraz',
  close: 'Zamknij',
  privacy: 'Polityka prywatności',
  version: (v) => `wersja ${v}`,
  saveError: 'Nie udało się zapisać wyboru. Spróbuj ponownie.',
  features: {
    injuries: {
      title: 'Śledzić urazy?',
      name: 'śledzenie urazów',
      what: 'Urazy, które zapisujesz: część ciała, strona, daty, oceny po rehabilitacji i notatki. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener widzi to tylko wtedy, gdy udostępnisz w „Prywatność”.',
      coach:
        'Dostęp trenera do Twoich urazów również zostaje wyłączony. Wymaga to połączenia; jeśli się nie uda, wyłącz go w ustawieniach udostępniania trenerowi.',
      limits:
        'Zapisane już ograniczenia bezpieczeństwa, na przykład uraz wymagający odpoczynku, nadal chronią Twój trening i serię. Tylko zmniejszają obciążenie i nigdy nie są pokazywane, udostępniane ani nigdzie wysyłane.',
    },
    chronic: {
      title: 'Dodać choroby przewlekłe?',
      name: 'choroby przewlekłe',
      what: 'Choroby przewlekłe, które wybierasz, ich nasilenie i od kiedy. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener widzi chorobę tylko wtedy, gdy ją udostępnisz.',
      coach: 'To, co trener o nich widział, zostaje usunięte.',
      limits:
        'Zapisane już ograniczenia bezpieczeństwa, na przykład ciąża lub schorzenie z ograniczeniami, nadal chronią Twój trening i utrzymują wstrzymany Cykl. Tylko zmniejszają obciążenie i nigdy nie są pokazywane, udostępniane ani nigdzie wysyłane.',
    },
    cycle: {
      title: 'Śledzić cykl?',
      name: 'śledzenie cyklu',
      what: 'Typowa długość cyklu i miesiączki oraz daty rozpoczęcia. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener nigdy tego nie dostaje.',
      coach: 'Trener nigdy tego nie dostawał.',
      limits: '',
    },
    nicotine: {
      title: 'Śledzić nikotynę?',
      name: 'śledzenie nikotyny',
      what: 'Produkty, których używasz, i zwykłe ilości, które wpisujesz. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener widzi to tylko wtedy, gdy udostępnisz w „Prywatność”.',
      coach: 'To, co trener o tym widział, zostaje usunięte.',
      limits: '',
    },
    alcohol: {
      title: 'Śledzić alkohol?',
      name: 'śledzenie alkoholu',
      what: 'Napoje i zwykłe porcje, które wpisujesz, oraz odpowiedzi na dane dni. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener widzi to tylko wtedy, gdy udostępnisz w „Prywatność”.',
      coach: 'To, co trener o tym widział, zostaje usunięte.',
      limits: '',
    },
    supplements: {
      title: 'Śledzić suplementy?',
      name: 'śledzenie suplementów',
      what: 'Suplementy, które bierzesz, ich dawka i pora oraz odpowiedzi na dane dni. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener widzi to tylko wtedy, gdy udostępnisz w „Prywatność”.',
      coach: 'To, co trener o tym widział, zostaje usunięte.',
      limits: '',
    },
    nutrition: {
      title: 'Śledzić odżywianie?',
      name: 'śledzenie odżywiania',
      what: 'Posiłki i produkty, które zapisujesz, z kaloriami i makroskładnikami, Twój cel i profil żywieniowy. To dane o zdrowiu.',
      who: 'W aplikacji tylko Ty. Trener widzi to tylko wtedy, gdy udostępnisz w „Prywatność”.',
      coach:
        'Dostęp trenera do Twojego dziennika żywienia również zostaje wyłączony. Wymaga to połączenia; jeśli się nie uda, wyłącz go w ustawieniach udostępniania trenerowi.',
      limits: '',
    },
  },
  offTitle: (f) => `${f}: wyłączone`,
  offBody:
    'Spotter nie zbiera ani nie pokazuje niczego dla tej funkcji, dopóki się nie zgodzisz. Reszta Spottera działa jak zwykle.',
  turnOn: 'Włącz',
  wTitle: (n) => `Wyłączyć: ${n}?`,
  wBody: (coach) =>
    `Funkcja przestaje działać. ${coach} Twoje wpisy zostają na koncie, nieużywane, dopóki ich nie usuniesz. Reszta Spottera działa dalej.`,
  wConfirm: 'Wycofaj zgodę',
  wKeep: 'Zostaw włączone',
  wFailed:
    'Funkcja jest wyłączona na tym urządzeniu, ale nie udało się zapisać wycofania zgody. Spróbuj ponownie, gdy będziesz online.',
  d1Title: (f) => `Usunąć dane: ${f}?`,
  d1Body:
    'Twoje wpisy dla tej funkcji zostaną usunięte z konta i z tego urządzenia. Możesz też je zostawić i usunąć później.',
  d1Confirm: 'Dalej',
  d1Limits: 'Usunięcie usuwa też te ograniczenia bezpieczeństwa, więc przestaną działać.',
  d2Title: 'Tego nie można cofnąć',
  d2Body: 'Usuniętych wpisów nie da się przywrócić.',
  d2Confirm: 'Usuń',
  dKeep: 'Zachowaj dane',
  dProgress: (i, n) => `Krok ${i} z ${n}`,
  dFailed: 'Nie udało się usunąć danych. Spróbuj ponownie.',
  disclaimer:
    'Spotter podaje ogólne informacje fitness, a nie porady medyczne. Jeśli masz uraz lub chorobę, porozmawiaj ze specjalistą.',
};

export const HEALTH_CONSENT_LOCALES: Partial<Record<LocaleId, HealthConsentStrings>> = {
  en,
  uk,
  pl,
};

export const healthConsentTexts = (locale: LocaleId): HealthConsentStrings =>
  HEALTH_CONSENT_LOCALES[locale] ?? en;

export function useHealthT(): HealthConsentStrings {
  return healthConsentTexts(useT().locale);
}
