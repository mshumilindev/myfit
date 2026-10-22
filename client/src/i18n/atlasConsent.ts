import { useT, type LocaleId } from './index';
import type { AtlasAiCategory } from '../legal/gateChoices';

/**
 * Words of the Atlas AI consent (SPO-286): the prompt shown when the AI chat (or its Puter backup) is turned on, the
 * withdraw dialog, the offer in the chat and the "AI" mark. English, Ukrainian and Polish; Lithuanian and Estonian read
 * the English text like the legal gate and the legal documents do. uk/pl are machine translations that need a native read
 * before launch (`legal/pending.ts`).
 *
 * "What is sent" is built from `categories`, one phrase for each entry of `ATLAS_AI_CATEGORIES`: the type makes a
 * category without words, and the test in `atlas/chatFacts.consent.test.ts` a payload key without a category, fail.
 */
export interface AtlasConsentStrings {
  title: string;
  lead: string;
  factsLabel: string;
  sentLabel: string;
  /** `list` = the categories joined in the person's language. */
  sent: (list: string) => string;
  categories: Record<AtlasAiCategory, string>;
  whoLabel: string;
  who: string;
  adviceLabel: string;
  advice: string;
  staysLabel: string;
  stays: string;
  choiceLabel: string;
  choice: string;
  primary: string;
  secondary: string;
  close: string;
  version: (v: string) => string;
  puterTitle: string;
  puterLead: string;
  puterWho: string;
  puterPrimary: string;
  offTitle: string;
  offBody: string;
  offClear: string;
  offConfirm: string;
  offKeep: string;
  offFailed: string;
  puterOffTitle: string;
  puterOffBody: string;
  saveFailed: string;
  aiTag: string;
  offer: string;
  settingsLabel: string;
  settingsSub: string;
  settingsOn: (v: string) => string;
  settingsOff: string;
}

const en: AtlasConsentStrings = {
  title: 'Turn on Atlas AI chat?',
  lead: 'Atlas can word free-form answers with an AI model. That means your data leaves Spotter. Read what is sent and to whom, then choose.',
  factsLabel: 'Details',
  sentLabel: 'What is sent',
  sent: (list) =>
    `Your question and the last messages of this chat, plus a summary of your training: ${list}.`,
  categories: {
    workouts:
      'recent workouts with exercises, weights and reps, and your history for each exercise',
    plan: 'your plan',
    notes: 'your notes and what you told Atlas',
    activities: 'other activities',
    'injured-muscles': 'injured muscles',
    'training-limits': 'training limits from long-term conditions (no names or notes)',
    sleep: 'last night’s sleep hours',
    bodyweight: 'body weight',
  },
  whoLabel: 'Who receives it',
  who: 'Google (Gemini API, free tier). On the free tier Google may use what you send to improve its products, and people may read it.',
  adviceLabel: 'Not medical advice',
  advice: 'Answers are written by an AI model and can be wrong. They are not medical advice.',
  staysLabel: 'What stays with you',
  stays:
    'Atlas answers from its built-in library without sending anything. Only this chat sends data out, and only after you turn it on. The chat history stays on this device.',
  choiceLabel: 'Your choice',
  choice:
    'Turn it off any time in Atlas settings or in Your privacy > Consents. Nothing more is sent after that. You will be asked again each time you turn it on.',
  primary: 'Turn on Atlas AI',
  secondary: 'Not now',
  close: 'Close',
  version: (v) => `Version ${v}`,
  puterTitle: 'Use Puter as backup?',
  puterLead:
    'When Google’s free limit for the day is used up, Atlas can ask through Puter instead. Puter is a separate service, so your data goes to it as well. Read what is sent and to whom, then choose.',
  puterWho:
    'Puter (puter.com), through your own Puter account and its own free allowance. Puter’s terms apply to what it does with the request.',
  puterPrimary: 'Use Puter',
  offTitle: 'Turn off Atlas AI chat?',
  offBody:
    'Nothing more is sent to Google or Puter. Atlas keeps answering from its built-in library.',
  offClear: 'Also clear this chat on this device',
  offConfirm: 'Turn off',
  offKeep: 'Keep on',
  offFailed:
    'Could not save this. Nothing is sent from this device. Try again when you are online.',
  puterOffTitle: 'Stop using Puter?',
  puterOffBody: 'Your questions are no longer sent to Puter. Atlas AI chat itself stays on.',
  saveFailed: 'Could not save. Please try again.',
  aiTag: 'AI reply',
  offer: 'Turn on Atlas AI',
  settingsLabel: 'AI chat',
  settingsSub: 'Free-form answers from an AI model. Sends data to Google.',
  settingsOn: (v) => `On · version ${v}`,
  settingsOff: 'Off',
};

const uk: AtlasConsentStrings = {
  title: 'Увімкнути AI-чат Atlas?',
  lead: 'Atlas може формулювати вільні відповіді за допомогою моделі ШІ. Це означає, що ваші дані залишають Spotter. Прочитайте, що надсилається і кому, а тоді вирішуйте.',
  factsLabel: 'Подробиці',
  sentLabel: 'Що надсилається',
  sent: (list) =>
    `Ваше запитання й останні повідомлення цього чату, а також підсумок тренувань: ${list}.`,
  categories: {
    workouts: 'останні тренування з вправами, вагами й повтореннями та історія кожної вправи',
    plan: 'ваш план',
    notes: 'ваші нотатки й те, що ви розповіли Atlas',
    activities: 'інші активності',
    'injured-muscles': 'травмовані м’язи',
    'training-limits': 'обмеження в тренуваннях через хронічні стани (без назв і нотаток)',
    sleep: 'тривалість сну минулої ночі',
    bodyweight: 'вага тіла',
  },
  whoLabel: 'Хто отримує',
  who: 'Google (Gemini API, безкоштовний рівень). На безкоштовному рівні Google може використовувати надіслане для вдосконалення своїх продуктів, і люди можуть це читати.',
  adviceLabel: 'Це не медична порада',
  advice: 'Відповіді пише модель ШІ, і вони можуть бути хибними. Це не медична порада.',
  staysLabel: 'Що лишається у вас',
  stays:
    'Atlas відповідає зі своєї вбудованої бібліотеки, нічого не надсилаючи. Дані назовні йдуть лише з цього чату і лише після вашого вмикання. Історія чату лишається на цьому пристрої.',
  choiceLabel: 'Ваш вибір',
  choice:
    'Вимкнути можна будь-коли в налаштуваннях Atlas або в «Ваша приватність > Згоди». Після цього нічого більше не надсилається. Щоразу, коли ви вмикаєте його знову, ми питатимемо ще раз.',
  primary: 'Увімкнути AI Atlas',
  secondary: 'Не зараз',
  close: 'Закрити',
  version: (v) => `Версія ${v}`,
  puterTitle: 'Використати Puter як резерв?',
  puterLead:
    'Коли денний безкоштовний ліміт Google вичерпано, Atlas може запитати через Puter. Puter — окремий сервіс, тож ваші дані підуть і до нього. Прочитайте, що надсилається і кому, а тоді вирішуйте.',
  puterWho:
    'Puter (puter.com) через ваш власний акаунт Puter і його безкоштовний ліміт. Що Puter робить із запитом, визначають його власні умови.',
  puterPrimary: 'Використати Puter',
  offTitle: 'Вимкнути AI-чат Atlas?',
  offBody:
    'Нічого більше не надсилається ні до Google, ні до Puter. Atlas і далі відповідає зі своєї вбудованої бібліотеки.',
  offClear: 'Також очистити цей чат на пристрої',
  offConfirm: 'Вимкнути',
  offKeep: 'Лишити',
  offFailed:
    'Не вдалося це зберегти. З цього пристрою нічого не надсилається. Спробуйте ще раз, коли будете онлайн.',
  puterOffTitle: 'Більше не використовувати Puter?',
  puterOffBody:
    'Ваші запитання більше не надсилаються до Puter. Сам AI-чат Atlas лишається увімкненим.',
  saveFailed: 'Не вдалося зберегти. Спробуйте ще раз.',
  aiTag: 'Відповідь ШІ',
  offer: 'Увімкнути AI Atlas',
  settingsLabel: 'AI-чат',
  settingsSub: 'Вільні відповіді від моделі ШІ. Надсилає дані до Google.',
  settingsOn: (v) => `Увімкнено · версія ${v}`,
  settingsOff: 'Вимкнено',
};

const pl: AtlasConsentStrings = {
  title: 'Włączyć czat AI Atlasa?',
  lead: 'Atlas może formułować swobodne odpowiedzi za pomocą modelu AI. To oznacza, że Twoje dane opuszczają Spotter. Przeczytaj, co jest wysyłane i do kogo, a potem zdecyduj.',
  factsLabel: 'Szczegóły',
  sentLabel: 'Co jest wysyłane',
  sent: (list) =>
    `Twoje pytanie i ostatnie wiadomości z tego czatu oraz podsumowanie treningów: ${list}.`,
  categories: {
    workouts:
      'ostatnie treningi z ćwiczeniami, ciężarami i powtórzeniami oraz historia każdego ćwiczenia',
    plan: 'Twój plan',
    notes: 'Twoje notatki i to, co powiedziałeś(-aś) Atlasowi',
    activities: 'inne aktywności',
    'injured-muscles': 'kontuzjowane mięśnie',
    'training-limits':
      'ograniczenia treningowe z powodu schorzeń przewlekłych (bez nazw i notatek)',
    sleep: 'długość snu z ostatniej nocy',
    bodyweight: 'masa ciała',
  },
  whoLabel: 'Kto to otrzymuje',
  who: 'Google (Gemini API, poziom bezpłatny). W wersji bezpłatnej Google może używać wysłanych danych do ulepszania swoich produktów, a ludzie mogą je czytać.',
  adviceLabel: 'To nie jest porada medyczna',
  advice: 'Odpowiedzi pisze model AI i mogą być błędne. To nie jest porada medyczna.',
  staysLabel: 'Co zostaje u Ciebie',
  stays:
    'Atlas odpowiada z własnej wbudowanej biblioteki, nic nie wysyłając. Dane wychodzą tylko z tego czatu i tylko po jego włączeniu. Historia czatu zostaje na tym urządzeniu.',
  choiceLabel: 'Twój wybór',
  choice:
    'Możesz to wyłączyć w dowolnej chwili w ustawieniach Atlasa lub w „Twoja prywatność > Zgody”. Potem nic więcej nie jest wysyłane. Zapytamy ponownie przy każdym włączeniu.',
  primary: 'Włącz AI Atlasa',
  secondary: 'Nie teraz',
  close: 'Zamknij',
  version: (v) => `Wersja ${v}`,
  puterTitle: 'Użyć Puter jako zapasu?',
  puterLead:
    'Gdy dzienny bezpłatny limit Google się wyczerpie, Atlas może zapytać przez Puter. Puter to osobna usługa, więc Twoje dane trafią także do niej. Przeczytaj, co jest wysyłane i do kogo, a potem zdecyduj.',
  puterWho:
    'Puter (puter.com), przez Twoje własne konto Puter i jego bezpłatny limit. O tym, co Puter robi z zapytaniem, decydują jego własne warunki.',
  puterPrimary: 'Użyj Puter',
  offTitle: 'Wyłączyć czat AI Atlasa?',
  offBody:
    'Nic więcej nie jest wysyłane do Google ani do Puter. Atlas nadal odpowiada z wbudowanej biblioteki.',
  offClear: 'Wyczyść też ten czat na urządzeniu',
  offConfirm: 'Wyłącz',
  offKeep: 'Zostaw',
  offFailed:
    'Nie udało się tego zapisać. Z tego urządzenia nic nie jest wysyłane. Spróbuj ponownie, gdy będziesz online.',
  puterOffTitle: 'Przestać używać Puter?',
  puterOffBody: 'Twoje pytania nie trafiają już do Puter. Sam czat AI Atlasa zostaje włączony.',
  saveFailed: 'Nie udało się zapisać. Spróbuj ponownie.',
  aiTag: 'Odpowiedź AI',
  offer: 'Włącz AI Atlasa',
  settingsLabel: 'Czat AI',
  settingsSub: 'Swobodne odpowiedzi modelu AI. Wysyła dane do Google.',
  settingsOn: (v) => `Włączone · wersja ${v}`,
  settingsOff: 'Wyłączone',
};

const ATLAS_CONSENT_LOCALES: Partial<Record<LocaleId, AtlasConsentStrings>> = { en, uk, pl };

const atlasConsentTexts = (locale: LocaleId): AtlasConsentStrings =>
  ATLAS_CONSENT_LOCALES[locale] ?? en;

export function useAtlasConsentT(): AtlasConsentStrings {
  return atlasConsentTexts(useT().locale);
}

/** The categories in the person's language: "a, b and c". */
export function categoryList(
  locale: LocaleId,
  tx: AtlasConsentStrings,
  cats: readonly AtlasAiCategory[],
): string {
  const words = cats.map((c) => tx.categories[c]);
  try {
    // Lithuanian and Estonian read the English words, so they get the English "and".
    return new Intl.ListFormat(locale in ATLAS_CONSENT_LOCALES ? locale : 'en', {
      style: 'long',
      type: 'conjunction',
    }).format(words);
  } catch {
    return words.join(', ');
  }
}
