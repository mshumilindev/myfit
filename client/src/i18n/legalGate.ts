import { useT, type LocaleId } from './index';
import { HEALTH_FEATURES, type HealthFeature } from '../legal/consents';

/**
 * Words of the legal gate for existing users (SPO-295 N12): drawer 1 (accept the Terms and Privacy Policy) and drawer 2
 * (choose the optional consents). English, Ukrainian and Polish; Lithuanian and Estonian read the English text like the
 * registration strings (`onbAgree*`) and the legal documents do. uk/pl are machine translations that need a native read
 * before launch (`legal/pending.ts`). The shared words (Continue, Sign out, Stay, the agreement block) come from `useT`.
 */
export interface GateChoiceText {
  label: string;
  sub: string;
  /** What happens while it is off, without the "If off:" lead. */
  hint: string;
}

export interface GatePageStrings {
  step: (n: number, total: number) => string;
  stepTerms: string;
  stepChoices: string;
  leftTitle: string;
  leftDone: string;
  loadSigningIn: string;
  loadSignedIn: string;
  loadChecked: string;
  loadRecording: string;
  loadSlow: string;
  loadChecking: string;
  loadRecorded: string;
  loadOpening: string;
  loadHint: string;
  readLabel: string;
  unreadLabel: string;
  leftRead: (doc: string) => string;
  leftAge: string;
  leftAgree: string;
  acceptAll: string;
  next: string;
  saving: string;
  waiting: string;
  failed: string;
  retry: string;
  finish: string;
  allOn: string;
  allOff: string;
  onCount: (n: number, total: number) => string;
  optionalNote: string;
  choicesSaving: string;
  choicesFailed: string;
}

export interface LegalGateStrings {
  page: GatePageStrings;
  termsTitle: string;
  termsLead: string;
  signOutBody: string;
  saveError: string;
  /** Continue was pressed but the server refused the consent for good (it was dropped): the drawer is shown again. */
  refusedError: string;
  /** Account whose consents cannot be checked yet (offline, first run on this device). */
  unverifiedTitle: string;
  unverifiedOffline: string;
  unverifiedChecking: string;
  unverifiedCheckingTitle: string;
  /** Online, but the check failed or timed out: a problem on our side or with the connection. */
  unverifiedErrorTitle: string;
  unverifiedError: string;
  unverifiedRetry: string;
  /** Muted, non-personal diagnostic line (an error code such as "permission-denied"). */
  unverifiedCode: (code: string) => string;
  choicesTitle: string;
  choicesLead: string;
  atlasHeader: string;
  atlasFooter: string;
  healthHeader: string;
  healthFooter: string;
  outsideHeader: string;
  ifOff: (hint: string) => string;
  notice: string;
  save: string;
  later: string;
  atlas: GateChoiceText;
  geo: GateChoiceText;
  health: Record<HealthFeature, GateChoiceText>;
}

const healthSub = (sub: string, hints: Record<HealthFeature, [string, string]>) =>
  Object.fromEntries(
    HEALTH_FEATURES.map((f) => [f, { label: hints[f][0], sub, hint: hints[f][1] }]),
  ) as Record<HealthFeature, GateChoiceText>;

const en: LegalGateStrings = {
  page: {
    step: (n, total) => `Step ${n} of ${total}`,
    stepTerms: 'Terms',
    stepChoices: 'Your choices',
    leftTitle: 'Still to do on this page',
    leftDone: 'Ready to continue',
    loadSigningIn: 'Signing you in',
    loadSignedIn: 'Signed in',
    loadChecked: 'Agreement checked',
    loadRecording: 'Recording your agreement',
    loadSlow: 'Taking longer than usual…',
    loadChecking: 'Checking your agreement',
    loadRecorded: 'Agreement recorded',
    loadOpening: 'Opening Spotter',
    loadHint: 'This only takes a few seconds, and only when something needs confirming.',
    readLabel: 'Read',
    unreadLabel: 'Scroll to the end',
    leftRead: (doc) => `Read: ${doc}`,
    leftAge: 'Confirm you are 18 or older',
    leftAgree: 'Tick the agreement',
    acceptAll: 'Accept all',
    next: 'Continue',
    saving: 'Saving your agreement…',
    waiting: 'Waiting for the connection to save your agreement. Keep this page open.',
    failed: 'We could not save your agreement yet. Your ticks are kept; try again.',
    retry: 'Try again',
    finish: 'Save and start',
    allOn: 'Turn on all',
    allOff: 'Turn off all',
    onCount: (n, total) => `${n} of ${total} on`,
    optionalNote: 'Nothing here is required. Skip it and Spotter works as before.',
    choicesSaving: 'Saving your choices…',
    choicesFailed: 'Some choices were not saved. Try again or skip.',
  },
  termsTitle: 'We updated how Spotter works with your data',
  termsLead:
    'You can now read the Terms of Use and the Privacy Policy, and choose your consents. To keep using Spotter, please read and accept the two documents.',
  signOutBody:
    "You can't use Spotter until you accept the Terms and Privacy Policy. Your data stays; you can also delete your account.",
  saveError: 'Could not save. Please try again.',
  refusedError:
    'We could not record your agreement. Please accept again; if this keeps happening, sign out and back in.',
  unverifiedTitle: 'Connect to continue',
  unverifiedOffline:
    'Spotter needs to check your agreement to the Terms and Privacy Policy once on this device. Connect to the internet to continue.',
  unverifiedChecking: 'Checking your agreement to the Terms and Privacy Policy…',
  unverifiedCheckingTitle: 'Checking your agreement',
  unverifiedErrorTitle: "We couldn't check your agreement",
  unverifiedError:
    "We couldn't check your agreement right now. This is a problem on our side or with your connection — try again.",
  unverifiedRetry: 'Try again',
  unverifiedCode: (code) => `Code: ${code}`,
  choicesTitle: 'Choose what Spotter may do',
  choicesLead:
    'Everything here is optional and off until you turn it on. Spotter works without any of it.',
  atlasHeader: 'Atlas AI',
  atlasFooter: 'All or nothing: Atlas AI chat sends data outside Spotter.',
  healthHeader: 'Health data',
  healthFooter:
    'Each health feature has its own consent. Your trainer sees nothing unless you share it.',
  outsideHeader: 'Outside Spotter',
  ifOff: (hint) => `If off: ${hint}`,
  notice: 'You can change any of this later in Settings > Your privacy > Consents.',
  save: 'Save my choices',
  later: 'Decide later',
  atlas: {
    label: 'Atlas AI chat',
    sub: 'Sends your question and a training summary to Google (Gemini, free tier). On the free tier Google may use it to improve its products.',
    hint: 'Atlas answers from its built-in library.',
  },
  geo: {
    label: 'Gym search and maps',
    sub: 'Sends your search and, if allowed, your position to map services.',
    hint: 'gym search and maps stay off.',
  },
  health: healthSub('Health data for this feature', {
    injuries: ['Injuries and illness', 'no injury log or rehab stages.'],
    chronic: ['Long-term conditions', 'no conditions in your plan.'],
    cycle: ['Cycle', 'no cycle tracking.'],
    nicotine: ['Nicotine', 'no nicotine tracking.'],
    alcohol: ['Alcohol', 'no alcohol tracking.'],
    supplements: ['Supplements', 'no supplement log.'],
    nutrition: ['Nutrition', 'no nutrition log.'],
  }),
};

const uk: LegalGateStrings = {
  page: {
    step: (n, total) => `Крок ${n} з ${total}`,
    stepTerms: 'Умови',
    stepChoices: 'Ваш вибір',
    leftTitle: 'Що ще лишилось на цій сторінці',
    leftDone: 'Готово до продовження',
    loadSigningIn: 'Входимо в акаунт',
    loadSignedIn: 'Вхід виконано',
    loadChecked: 'Згоду перевірено',
    loadRecording: 'Записуємо вашу згоду',
    loadSlow: 'Довше, ніж зазвичай…',
    loadChecking: 'Перевіряємо вашу згоду',
    loadRecorded: 'Згоду записано',
    loadOpening: 'Відкриваємо Spotter',
    loadHint: 'Це кілька секунд, і лише коли треба щось підтвердити.',
    readLabel: 'Прочитано',
    unreadLabel: 'Прокрутіть до кінця',
    leftRead: (doc) => `Прочитати: ${doc}`,
    leftAge: 'Підтвердити, що вам 18 або більше',
    leftAgree: 'Поставити позначку згоди',
    acceptAll: 'Прийняти все',
    next: 'Продовжити',
    saving: 'Записуємо вашу згоду…',
    waiting: 'Чекаємо на з’єднання, щоб записати вашу згоду. Не закривайте сторінку.',
    failed: 'Поки не вдалося записати вашу згоду. Позначки збережено; спробуйте ще раз.',
    retry: 'Спробувати ще раз',
    finish: 'Зберегти й почати',
    allOn: 'Увімкнути все',
    allOff: 'Вимкнути все',
    onCount: (n, total) => `Увімкнено ${n} з ${total}`,
    optionalNote: 'Тут нічого не обов’язково. Пропустіть, і Spotter працює як раніше.',
    choicesSaving: 'Зберігаємо ваш вибір…',
    choicesFailed: 'Частину вибору не збережено. Спробуйте ще раз або пропустіть.',
  },
  termsTitle: 'Ми оновили, як Spotter працює з вашими даними',
  termsLead:
    'Тепер ви можете прочитати Умови використання та Політику конфіденційності й обрати свої згоди. Щоб продовжити користуватися Spotter, прочитайте й прийміть обидва документи.',
  signOutBody:
    'Ви не зможете користуватися Spotter, доки не приймете Умови та Політику конфіденційності. Ваші дані залишаться; ви також можете видалити акаунт.',
  saveError: 'Не вдалося зберегти. Спробуйте ще раз.',
  refusedError:
    'Не вдалося записати вашу згоду. Прийміть ще раз; якщо це повторюється, вийдіть і увійдіть знову.',
  unverifiedTitle: 'Підключіться, щоб продовжити',
  unverifiedOffline:
    'Spotter має один раз перевірити на цьому пристрої вашу згоду з Умовами та Політикою конфіденційності. Підключіться до інтернету, щоб продовжити.',
  unverifiedChecking: 'Перевіряємо вашу згоду з Умовами та Політикою конфіденційності…',
  unverifiedCheckingTitle: 'Перевіряємо вашу згоду',
  unverifiedErrorTitle: 'Не вдалося перевірити вашу згоду',
  unverifiedError:
    'Зараз не вдалося перевірити вашу згоду. Це проблема з нашого боку або зі з’єднанням — спробуйте ще раз.',
  unverifiedRetry: 'Спробувати ще раз',
  unverifiedCode: (code) => `Код: ${code}`,
  choicesTitle: 'Оберіть, що Spotter може робити',
  choicesLead:
    'Усе тут необов’язкове й вимкнене, доки ви його не ввімкнете. Spotter працює і без цього.',
  atlasHeader: 'Atlas AI',
  atlasFooter: 'Усе або нічого: чат Atlas AI надсилає дані за межі Spotter.',
  healthHeader: 'Дані про здоров’я',
  healthFooter:
    'Кожна функція здоров’я має окрему згоду. Ваш тренер нічого не бачить, доки ви не поділитеся.',
  outsideHeader: 'За межами Spotter',
  ifOff: (hint) => `Якщо вимкнено: ${hint}`,
  notice: 'Змінити це можна пізніше в Налаштування > Ваша приватність > Згоди.',
  save: 'Зберегти мій вибір',
  later: 'Вирішу пізніше',
  atlas: {
    label: 'Чат Atlas AI',
    sub: 'Надсилає ваше запитання та підсумок тренувань до Google (Gemini, безкоштовний рівень). На безкоштовному рівні Google може використовувати це для вдосконалення своїх продуктів.',
    hint: 'Atlas відповідає з вбудованої бібліотеки.',
  },
  geo: {
    label: 'Пошук залів і мапи',
    sub: 'Надсилає ваш пошук і, якщо дозволите, ваше місцеперебування картографічним сервісам.',
    hint: 'пошук залів і мапи лишаються вимкненими.',
  },
  health: healthSub('Дані про здоров’я для цієї функції', {
    injuries: ['Травми та хвороби', 'немає журналу травм і етапів реабілітації.'],
    chronic: ['Довготривалі стани', 'немає станів у вашому плані.'],
    cycle: ['Цикл', 'немає відстеження циклу.'],
    nicotine: ['Нікотин', 'немає відстеження нікотину.'],
    alcohol: ['Алкоголь', 'немає відстеження алкоголю.'],
    supplements: ['Добавки', 'немає журналу добавок.'],
    nutrition: ['Харчування', 'немає журналу харчування.'],
  }),
};

const pl: LegalGateStrings = {
  page: {
    step: (n, total) => `Krok ${n} z ${total}`,
    stepTerms: 'Warunki',
    stepChoices: 'Twój wybór',
    leftTitle: 'Co jeszcze zostało na tej stronie',
    leftDone: 'Gotowe do kontynuacji',
    loadSigningIn: 'Logujemy Cię',
    loadSignedIn: 'Zalogowano',
    loadChecked: 'Zgoda sprawdzona',
    loadRecording: 'Zapisujemy Twoją zgodę',
    loadSlow: 'Trwa dłużej niż zwykle…',
    loadChecking: 'Sprawdzamy Twoją zgodę',
    loadRecorded: 'Zgoda zapisana',
    loadOpening: 'Otwieramy Spotter',
    loadHint: 'To kilka sekund i tylko wtedy, gdy trzeba coś potwierdzić.',
    readLabel: 'Przeczytano',
    unreadLabel: 'Przewiń do końca',
    leftRead: (doc) => `Przeczytaj: ${doc}`,
    leftAge: 'Potwierdź, że masz 18 lat lub więcej',
    leftAgree: 'Zaznacz zgodę',
    acceptAll: 'Zaakceptuj wszystko',
    next: 'Kontynuuj',
    saving: 'Zapisujemy Twoją zgodę…',
    waiting: 'Czekamy na połączenie, aby zapisać Twoją zgodę. Nie zamykaj strony.',
    failed: 'Nie udało się jeszcze zapisać Twojej zgody. Zaznaczenia zostały; spróbuj ponownie.',
    retry: 'Spróbuj ponownie',
    finish: 'Zapisz i zacznij',
    allOn: 'Włącz wszystko',
    allOff: 'Wyłącz wszystko',
    onCount: (n, total) => `Włączono ${n} z ${total}`,
    optionalNote: 'Nic tu nie jest wymagane. Pomiń, a Spotter działa jak dotąd.',
    choicesSaving: 'Zapisujemy Twój wybór…',
    choicesFailed: 'Część wyborów nie została zapisana. Spróbuj ponownie lub pomiń.',
  },
  termsTitle: 'Zaktualizowaliśmy sposób, w jaki Spotter korzysta z Twoich danych',
  termsLead:
    'Możesz teraz przeczytać Regulamin i Politykę prywatności oraz wybrać swoje zgody. Aby nadal korzystać ze Spottera, przeczytaj i zaakceptuj oba dokumenty.',
  signOutBody:
    'Nie możesz korzystać ze Spottera, dopóki nie zaakceptujesz Regulaminu i Polityki prywatności. Twoje dane zostają; możesz też usunąć konto.',
  saveError: 'Nie udało się zapisać. Spróbuj ponownie.',
  refusedError:
    'Nie udało się zapisać Twojej zgody. Zaakceptuj ponownie; jeśli problem się powtarza, wyloguj się i zaloguj ponownie.',
  unverifiedTitle: 'Połącz się, aby kontynuować',
  unverifiedOffline:
    'Spotter musi raz sprawdzić na tym urządzeniu Twoją zgodę na Warunki i Politykę prywatności. Połącz się z internetem, aby kontynuować.',
  unverifiedChecking: 'Sprawdzamy Twoją zgodę na Warunki i Politykę prywatności…',
  unverifiedCheckingTitle: 'Sprawdzamy Twoją zgodę',
  unverifiedErrorTitle: 'Nie udało się sprawdzić Twojej zgody',
  unverifiedError:
    'Teraz nie udało się sprawdzić Twojej zgody. To problem po naszej stronie lub z połączeniem — spróbuj ponownie.',
  unverifiedRetry: 'Spróbuj ponownie',
  unverifiedCode: (code) => `Kod: ${code}`,
  choicesTitle: 'Wybierz, co może robić Spotter',
  choicesLead:
    'Wszystko tutaj jest opcjonalne i wyłączone, dopóki tego nie włączysz. Spotter działa także bez tego.',
  atlasHeader: 'Atlas AI',
  atlasFooter: 'Wszystko albo nic: czat Atlas AI wysyła dane poza Spotter.',
  healthHeader: 'Dane o zdrowiu',
  healthFooter:
    'Każda funkcja zdrowotna ma osobną zgodę. Trener nic nie widzi, dopóki mu tego nie udostępnisz.',
  outsideHeader: 'Poza Spotterem',
  ifOff: (hint) => `Jeśli wyłączone: ${hint}`,
  notice: 'Możesz to zmienić później w Ustawienia > Twoja prywatność > Zgody.',
  save: 'Zapisz mój wybór',
  later: 'Zdecyduję później',
  atlas: {
    label: 'Czat Atlas AI',
    sub: 'Wysyła Twoje pytanie i podsumowanie treningów do Google (Gemini, wersja bezpłatna). W wersji bezpłatnej Google może używać tych danych do ulepszania swoich produktów.',
    hint: 'Atlas odpowiada z wbudowanej biblioteki.',
  },
  geo: {
    label: 'Wyszukiwanie siłowni i mapy',
    sub: 'Wysyła Twoje wyszukiwanie i, jeśli pozwolisz, Twoją pozycję do serwisów map.',
    hint: 'wyszukiwanie siłowni i mapy pozostają wyłączone.',
  },
  health: healthSub('Dane o zdrowiu dla tej funkcji', {
    injuries: ['Kontuzje i choroby', 'brak dziennika kontuzji i etapów rehabilitacji.'],
    chronic: ['Schorzenia przewlekłe', 'brak schorzeń w Twoim planie.'],
    cycle: ['Cykl', 'brak śledzenia cyklu.'],
    nicotine: ['Nikotyna', 'brak śledzenia nikotyny.'],
    alcohol: ['Alkohol', 'brak śledzenia alkoholu.'],
    supplements: ['Suplementy', 'brak dziennika suplementów.'],
    nutrition: ['Odżywianie', 'brak dziennika odżywiania.'],
  }),
};

export const LEGAL_GATE_LOCALES: Partial<Record<LocaleId, LegalGateStrings>> = { en, uk, pl };

export const legalGateTexts = (locale: LocaleId): LegalGateStrings =>
  LEGAL_GATE_LOCALES[locale] ?? en;

export function useGateT(): LegalGateStrings {
  return legalGateTexts(useT().locale);
}
