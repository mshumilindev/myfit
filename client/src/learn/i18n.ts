/**
 * Learn UI strings, localised to the suite's five languages. Lesson titles and
 * blurbs live in catalog.ts and stay in the language a lesson is recorded in
 * (the spoken content), so only the app chrome is translated here. The active
 * language comes from the main i18n via useT().locale.
 */
import { useT } from '../i18n';

type Lang = 'en' | 'uk' | 'pl' | 'lt' | 'et';

export interface LearnStrings {
  app: string;
  home: string;
  topics: string;
  saved: string;
  apps: string;
  notifications: string;
  search: string;
  filters: string;
  clear: string;
  all: string;
  howTo: string;
  continueLabel: string;
  videoComingSoon: string;
  soon: string;
  comingSoonTitle: string;
  comingSoonBody: string;
  save: string;
  savedDone: string;
  upNext: string;
  phone: string;
  web: string;
  nothingSaved: string;
  savedHint: string;
  browse: string;
  results: string;
  noResults: string;
  /** "{n} lessons" */
  lessons: (n: number) => string;
  /** "{n} videos" */
  videos: (n: number) => string;
  /** "{done} / {total}" progress is composed inline. */
}

const en: LearnStrings = {
  app: 'Learn',
  home: 'Home',
  topics: 'Topics',
  saved: 'Saved',
  apps: 'Apps',
  notifications: 'Notifications',
  search: 'Search lessons',
  filters: 'Filters',
  clear: 'Clear',
  all: 'All',
  howTo: 'How to Spotter',
  continueLabel: 'Continue',
  videoComingSoon: 'Video coming soon',
  soon: 'Soon',
  comingSoonTitle: 'This lesson is coming soon',
  comingSoonBody: 'We’re recording it in two cuts — phone and web. Save it and we’ll notify you.',
  save: 'Save',
  savedDone: 'Saved',
  upNext: 'Up next',
  phone: 'Phone',
  web: 'Web',
  nothingSaved: 'Nothing saved yet',
  savedHint: 'Tap the bookmark on any lesson to keep it here for later.',
  browse: 'Browse lessons',
  results: 'Results',
  noResults: 'No lessons match',
  lessons: (n) => `${n} lessons`,
  videos: (n) => `${n} videos`,
};

const uk: LearnStrings = {
  app: 'Learn',
  home: 'Головна',
  topics: 'Теми',
  saved: 'Збережені',
  apps: 'Додатки',
  notifications: 'Сповіщення',
  search: 'Пошук уроків',
  filters: 'Фільтри',
  clear: 'Очистити',
  all: 'Усі',
  howTo: 'Як користуватись Spotter',
  continueLabel: 'Продовжити',
  videoComingSoon: 'Відео незабаром',
  soon: 'Скоро',
  comingSoonTitle: 'Цей урок зʼявиться незабаром',
  comingSoonBody: 'Ми знімаємо його у двох форматах — телефон і веб. Збережіть, і ми сповістимо вас.',
  save: 'Зберегти',
  savedDone: 'Збережено',
  upNext: 'Далі',
  phone: 'Телефон',
  web: 'Веб',
  nothingSaved: 'Поки нічого не збережено',
  savedHint: 'Натисніть закладку на будь-якому уроці, щоб зберегти його сюди.',
  browse: 'Переглянути уроки',
  results: 'Результати',
  noResults: 'Нічого не знайдено',
  lessons: (n) => `${n} уроків`,
  videos: (n) => `${n} відео`,
};

const pl: LearnStrings = {
  app: 'Learn',
  home: 'Główna',
  topics: 'Tematy',
  saved: 'Zapisane',
  apps: 'Aplikacje',
  notifications: 'Powiadomienia',
  search: 'Szukaj lekcji',
  filters: 'Filtry',
  clear: 'Wyczyść',
  all: 'Wszystko',
  howTo: 'Jak korzystać ze Spotter',
  continueLabel: 'Kontynuuj',
  videoComingSoon: 'Wideo wkrótce',
  soon: 'Wkrótce',
  comingSoonTitle: 'Ta lekcja pojawi się wkrótce',
  comingSoonBody: 'Nagrywamy ją w dwóch wersjach — telefon i web. Zapisz, a powiadomimy Cię.',
  save: 'Zapisz',
  savedDone: 'Zapisano',
  upNext: 'Dalej',
  phone: 'Telefon',
  web: 'Web',
  nothingSaved: 'Nic jeszcze nie zapisano',
  savedHint: 'Dotknij zakładki przy dowolnej lekcji, aby zapisać ją tutaj.',
  browse: 'Przeglądaj lekcje',
  results: 'Wyniki',
  noResults: 'Brak pasujących lekcji',
  lessons: (n) => `${n} lekcji`,
  videos: (n) => `${n} wideo`,
};

const lt: LearnStrings = {
  app: 'Learn',
  home: 'Pradžia',
  topics: 'Temos',
  saved: 'Išsaugoti',
  apps: 'Programos',
  notifications: 'Pranešimai',
  search: 'Ieškoti pamokų',
  filters: 'Filtrai',
  clear: 'Išvalyti',
  all: 'Visi',
  howTo: 'Kaip naudotis Spotter',
  continueLabel: 'Tęsti',
  videoComingSoon: 'Vaizdo įrašas netrukus',
  soon: 'Netrukus',
  comingSoonTitle: 'Ši pamoka bus netrukus',
  comingSoonBody: 'Įrašome ją dviem formatais — telefonui ir internetui. Išsaugokite ir pranešime.',
  save: 'Išsaugoti',
  savedDone: 'Išsaugota',
  upNext: 'Toliau',
  phone: 'Telefonas',
  web: 'Internetas',
  nothingSaved: 'Kol kas nieko neišsaugota',
  savedHint: 'Palieskite žymę bet kurioje pamokoje, kad išsaugotumėte ją čia.',
  browse: 'Naršyti pamokas',
  results: 'Rezultatai',
  noResults: 'Nėra atitinkančių pamokų',
  lessons: (n) => `${n} pamokų`,
  videos: (n) => `${n} vaizdo įr.`,
};

const et: LearnStrings = {
  app: 'Learn',
  home: 'Avaleht',
  topics: 'Teemad',
  saved: 'Salvestatud',
  apps: 'Rakendused',
  notifications: 'Teavitused',
  search: 'Otsi õppetunde',
  filters: 'Filtrid',
  clear: 'Tühjenda',
  all: 'Kõik',
  howTo: 'Kuidas kasutada Spotterit',
  continueLabel: 'Jätka',
  videoComingSoon: 'Video tuleb varsti',
  soon: 'Varsti',
  comingSoonTitle: 'See õppetund tuleb varsti',
  comingSoonBody: 'Salvestame selle kahes formaadis — telefon ja veeb. Salvesta ja anname teada.',
  save: 'Salvesta',
  savedDone: 'Salvestatud',
  upNext: 'Järgmisena',
  phone: 'Telefon',
  web: 'Veeb',
  nothingSaved: 'Midagi pole veel salvestatud',
  savedHint: 'Puuduta järjehoidjat mis tahes õppetunnil, et see siia hoiule panna.',
  browse: 'Sirvi õppetunde',
  results: 'Tulemused',
  noResults: 'Sobivaid õppetunde ei leitud',
  lessons: (n) => `${n} õppetundi`,
  videos: (n) => `${n} videot`,
};

const DICTS: Record<Lang, LearnStrings> = { en, uk, pl, lt, et };

export function useLearnT(): { L: LearnStrings; locale: Lang } {
  const { locale } = useT();
  const lang = (['en', 'uk', 'pl', 'lt', 'et'] as const).includes(locale as Lang)
    ? (locale as Lang)
    : 'en';
  return { L: DICTS[lang], locale: lang };
}
