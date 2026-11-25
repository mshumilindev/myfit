import type { LocaleId } from '../i18n';

/** Train like a pro's own words (they live in the add-on's chunk, not in the core dictionaries). */
export interface TlStrings {
  name: string;
  back: string;
  count: (n: number) => string;
  search: string;
  clearSearch: string;
  filters: string;
  filtersOn: (n: number) => string;
  activeFilters: string;
  clearAll: string;
  remove: (label: string) => string;
  showN: (n: number) => string;
  period: string;
  groups: Record<'goal' | 'level' | 'days' | 'gear' | 'era' | 'origin', string>;
  goal: Record<'mass' | 'strength' | 'shape' | 'general', string>;
  level: Record<'beginner' | 'intermediate' | 'advanced' | 'elite', string>;
  days: Record<'1-2' | '3' | '4' | '5' | '6-7', string>;
  gear: Record<'none' | 'basic' | 'full', string>;
  era: Record<
    'pre-1940' | 'golden-age' | 'arnold-era' | 'mass-monsters' | 'modern' | 'current' | 'unknown',
    string
  >;
  origin: Record<'official' | 'book' | 'media', string>;
  /** Unit tails of the facts line: "3 d/wk · 12 wk". */
  perWeek: string;
  weeksShort: string;
  needs: (addon: string) => string;
  emptyTitle: string;
  emptyBody: string;
  start: string;
  get: (addon: string) => string;
  lockedBody: (addon: string) => string;
  eliteWarning: string;
  week: string;
  exercises: (n: number) => string;
  rest: string;
  source: string;
  sourceKind: string;
  notVerified: string;
  disclaimer: string;
  weekdays: string[];
}

const fill1 = (s: string, n: number | string) => s.replace('{n}', String(n));

const en: TlStrings = {
  name: 'Train like a pro',
  back: 'Back',
  count: (n) => fill1('{n} programs', n),
  search: 'Search athletes, programs, exercises',
  clearSearch: 'Clear search',
  filters: 'Filters',
  filtersOn: (n) => fill1('Filters · {n}', n),
  activeFilters: 'Active filters',
  clearAll: 'Clear all',
  remove: (l) => `Remove ${l}`,
  showN: (n) => fill1('Show {n} programs', n),
  period: 'Period and source',
  groups: {
    goal: 'Goal',
    level: 'Level',
    days: 'Days a week',
    gear: 'Equipment',
    era: 'Period',
    origin: 'Source',
  },
  goal: {
    mass: 'Muscle mass',
    strength: 'Strength',
    shape: 'Physique',
    general: 'General fitness',
  },
  level: {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    elite: 'Elite',
  },
  days: { '1-2': '1–2 days', '3': '3 days', '4': '4 days', '5': '5 days', '6-7': '6–7 days' },
  gear: { none: 'No equipment', basic: 'Barbell and dumbbells', full: 'Full gym' },
  era: {
    'pre-1940': 'Before 1940',
    'golden-age': 'Golden age',
    'arnold-era': '1970s–80s',
    'mass-monsters': '1990s',
    modern: '2000s–2010s',
    current: 'Today',
    unknown: 'Period not stated',
  },
  origin: { official: "Author's own site", book: 'Book or magazine', media: 'Media article' },
  perWeek: 'd/wk',
  weeksShort: 'wk',
  needs: (a) => `Needs ${a}`,
  emptyTitle: 'No programs found',
  emptyBody: 'Try fewer filters or a different search.',
  start: 'Start this program',
  get: (a) => `Get ${a}`,
  lockedBody: (a) =>
    `This program uses ${a}. Install it to start the program as described. Until then you can read it here.`,
  eliteWarning:
    'Built for very experienced lifters. If you are new to training, pick a beginner program.',
  week: 'The week',
  exercises: (n) => fill1('{n} exercises', n),
  rest: 'Rest',
  source: 'Source',
  sourceKind: 'Where it comes from',
  notVerified: 'Not checked against the original publication.',
  disclaimer:
    'Programs are described as published by the source. They are not made, endorsed or checked by the athletes or authors named, and Spotter is not affiliated with them.',
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const uk: TlStrings = {
  name: 'Train like a pro',
  back: 'Назад',
  count: (n) => fill1('Програм: {n}', n),
  search: 'Пошук атлетів, програм, вправ',
  clearSearch: 'Очистити пошук',
  filters: 'Фільтри',
  filtersOn: (n) => fill1('Фільтри · {n}', n),
  activeFilters: 'Активні фільтри',
  clearAll: 'Скинути все',
  remove: (l) => `Прибрати: ${l}`,
  showN: (n) => fill1('Показати програм: {n}', n),
  period: 'Період і джерело',
  groups: {
    goal: 'Ціль',
    level: 'Рівень',
    days: 'Днів на тиждень',
    gear: 'Обладнання',
    era: 'Період',
    origin: 'Джерело',
  },
  goal: { mass: "М'язова маса", strength: 'Сила', shape: 'Фізика', general: 'Загальна форма' },
  level: {
    beginner: 'Початківець',
    intermediate: 'Середній',
    advanced: 'Просунутий',
    elite: 'Еліта',
  },
  days: { '1-2': '1–2 дні', '3': '3 дні', '4': '4 дні', '5': '5 днів', '6-7': '6–7 днів' },
  gear: { none: 'Без обладнання', basic: 'Штанга й гантелі', full: 'Повний зал' },
  era: {
    'pre-1940': 'До 1940',
    'golden-age': 'Золота ера',
    'arnold-era': '1970–80-ті',
    'mass-monsters': '1990-ті',
    modern: '2000–2010-ті',
    current: 'Сьогодні',
    unknown: 'Період не вказано',
  },
  origin: { official: 'Сайт автора', book: 'Книга або журнал', media: 'Стаття у медіа' },
  perWeek: 'дн/тиж',
  weeksShort: 'тиж',
  needs: (a) => `Потрібен ${a}`,
  emptyTitle: 'Програм не знайдено',
  emptyBody: 'Спробуйте менше фільтрів або інший запит.',
  start: 'Почати цю програму',
  get: (a) => `Отримати ${a}`,
  lockedBody: (a) =>
    `Ця програма використовує ${a}. Встановіть його, щоб почати програму як описано. Поки що її можна читати тут.`,
  eliteWarning:
    'Для дуже досвідчених. Якщо ви ще нові в тренуваннях, оберіть програму для початківців.',
  week: 'Тиждень',
  exercises: (n) => fill1('Вправ: {n}', n),
  rest: 'Відпочинок',
  source: 'Джерело',
  sourceKind: 'Звідки це',
  notVerified: 'Не звірено з оригінальною публікацією.',
  disclaimer:
    'Програми описано так, як їх опублікувало джерело. Названі атлети й автори їх не створювали, не схвалювали й не перевіряли, а Spotter з ними не повʼязаний.',
  weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
};

const pl: TlStrings = {
  name: 'Train like a pro',
  back: 'Wstecz',
  count: (n) => fill1('Programy: {n}', n),
  search: 'Szukaj sportowców, programów, ćwiczeń',
  clearSearch: 'Wyczyść wyszukiwanie',
  filters: 'Filtry',
  filtersOn: (n) => fill1('Filtry · {n}', n),
  activeFilters: 'Aktywne filtry',
  clearAll: 'Wyczyść wszystko',
  remove: (l) => `Usuń: ${l}`,
  showN: (n) => fill1('Pokaż programy: {n}', n),
  period: 'Okres i źródło',
  groups: {
    goal: 'Cel',
    level: 'Poziom',
    days: 'Dni w tygodniu',
    gear: 'Sprzęt',
    era: 'Okres',
    origin: 'Źródło',
  },
  goal: { mass: 'Masa mięśniowa', strength: 'Siła', shape: 'Sylwetka', general: 'Ogólna forma' },
  level: {
    beginner: 'Początkujący',
    intermediate: 'Średni',
    advanced: 'Zaawansowany',
    elite: 'Elita',
  },
  days: { '1-2': '1–2 dni', '3': '3 dni', '4': '4 dni', '5': '5 dni', '6-7': '6–7 dni' },
  gear: { none: 'Bez sprzętu', basic: 'Sztanga i hantle', full: 'Pełna siłownia' },
  era: {
    'pre-1940': 'Przed 1940',
    'golden-age': 'Złota era',
    'arnold-era': 'Lata 70.–80.',
    'mass-monsters': 'Lata 90.',
    modern: 'Lata 2000–2010',
    current: 'Dziś',
    unknown: 'Okres nie podany',
  },
  origin: { official: 'Strona autora', book: 'Książka lub magazyn', media: 'Artykuł w mediach' },
  perWeek: 'dn./tydz.',
  weeksShort: 'tydz.',
  needs: (a) => `Wymaga: ${a}`,
  emptyTitle: 'Nie znaleziono programów',
  emptyBody: 'Spróbuj z mniejszą liczbą filtrów lub innym zapytaniem.',
  start: 'Zacznij ten program',
  get: (a) => `Zdobądź: ${a}`,
  lockedBody: (a) =>
    `Ten program używa dodatku ${a}. Zainstaluj go, aby zacząć program zgodnie z opisem. Do tego czasu możesz go tu czytać.`,
  eliteWarning:
    'Dla bardzo doświadczonych. Jeśli dopiero zaczynasz trenować, wybierz program dla początkujących.',
  week: 'Tydzień',
  exercises: (n) => fill1('Ćwiczenia: {n}', n),
  rest: 'Odpoczynek',
  source: 'Źródło',
  sourceKind: 'Skąd pochodzi',
  notVerified: 'Nie sprawdzono z oryginalną publikacją.',
  disclaimer:
    'Programy są opisane tak, jak opublikowało je źródło. Wymienieni sportowcy i autorzy ich nie stworzyli, nie zatwierdzili ani nie sprawdzili, a Spotter nie jest z nimi powiązany.',
  weekdays: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'],
};

const lt: TlStrings = {
  name: 'Train like a pro',
  back: 'Atgal',
  count: (n) => fill1('Programų: {n}', n),
  search: 'Ieškoti sportininkų, programų, pratimų',
  clearSearch: 'Išvalyti paiešką',
  filters: 'Filtrai',
  filtersOn: (n) => fill1('Filtrai · {n}', n),
  activeFilters: 'Aktyvūs filtrai',
  clearAll: 'Išvalyti viską',
  remove: (l) => `Pašalinti: ${l}`,
  showN: (n) => fill1('Rodyti programų: {n}', n),
  period: 'Laikotarpis ir šaltinis',
  groups: {
    goal: 'Tikslas',
    level: 'Lygis',
    days: 'Dienų per savaitę',
    gear: 'Įranga',
    era: 'Laikotarpis',
    origin: 'Šaltinis',
  },
  goal: { mass: 'Raumenų masė', strength: 'Jėga', shape: 'Kūno forma', general: 'Bendra forma' },
  level: {
    beginner: 'Pradedantysis',
    intermediate: 'Vidutinis',
    advanced: 'Pažengęs',
    elite: 'Elitas',
  },
  days: {
    '1-2': '1–2 dienos',
    '3': '3 dienos',
    '4': '4 dienos',
    '5': '5 dienų',
    '6-7': '6–7 dienos',
  },
  gear: { none: 'Be įrangos', basic: 'Štanga ir hanteliai', full: 'Pilna sporto salė' },
  era: {
    'pre-1940': 'Iki 1940',
    'golden-age': 'Auksinė era',
    'arnold-era': '8–9 dešimtmetis',
    'mass-monsters': '1990-ieji',
    modern: '2000–2010-ieji',
    current: 'Šiandien',
    unknown: 'Laikotarpis nenurodytas',
  },
  origin: {
    official: 'Autoriaus svetainė',
    book: 'Knyga ar žurnalas',
    media: 'Straipsnis žiniasklaidoje',
  },
  perWeek: 'd./sav.',
  weeksShort: 'sav.',
  needs: (a) => `Reikia: ${a}`,
  emptyTitle: 'Programų nerasta',
  emptyBody: 'Pabandykite mažiau filtrų arba kitą paiešką.',
  start: 'Pradėti šią programą',
  get: (a) => `Gauti: ${a}`,
  lockedBody: (a) =>
    `Ši programa naudoja priedą ${a}. Įdiekite jį, kad programą pradėtumėte kaip aprašyta. Kol kas ją galite skaityti čia.`,
  eliteWarning:
    'Skirta labai patyrusiems. Jei treniruotės jums naujiena, rinkitės pradedančiųjų programą.',
  week: 'Savaitė',
  exercises: (n) => fill1('Pratimų: {n}', n),
  rest: 'Poilsis',
  source: 'Šaltinis',
  sourceKind: 'Iš kur tai',
  notVerified: 'Nepatikrinta pagal originalų leidinį.',
  disclaimer:
    'Programos aprašytos taip, kaip jas paskelbė šaltinis. Paminėti sportininkai ir autoriai jų nesukūrė, nepatvirtino ir nepatikrino, o „Spotter“ su jais nėra susijęs.',
  weekdays: ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'],
};

const et: TlStrings = {
  name: 'Train like a pro',
  back: 'Tagasi',
  count: (n) => fill1('Programme: {n}', n),
  search: 'Otsi sportlasi, programme, harjutusi',
  clearSearch: 'Tühjenda otsing',
  filters: 'Filtrid',
  filtersOn: (n) => fill1('Filtrid · {n}', n),
  activeFilters: 'Aktiivsed filtrid',
  clearAll: 'Tühjenda kõik',
  remove: (l) => `Eemalda: ${l}`,
  showN: (n) => fill1('Näita programme: {n}', n),
  period: 'Periood ja allikas',
  groups: {
    goal: 'Eesmärk',
    level: 'Tase',
    days: 'Päeva nädalas',
    gear: 'Varustus',
    era: 'Periood',
    origin: 'Allikas',
  },
  goal: { mass: 'Lihasmass', strength: 'Jõud', shape: 'Kehakuju', general: 'Üldine vorm' },
  level: { beginner: 'Algaja', intermediate: 'Kesktase', advanced: 'Edasijõudnu', elite: 'Eliit' },
  days: { '1-2': '1–2 päeva', '3': '3 päeva', '4': '4 päeva', '5': '5 päeva', '6-7': '6–7 päeva' },
  gear: { none: 'Ilma varustuseta', basic: 'Kang ja hantlid', full: 'Täielik jõusaal' },
  era: {
    'pre-1940': 'Enne 1940',
    'golden-age': 'Kuldne ajastu',
    'arnold-era': '1970.–80. aastad',
    'mass-monsters': '1990. aastad',
    modern: '2000.–2010. aastad',
    current: 'Tänapäev',
    unknown: 'Periood märkimata',
  },
  origin: { official: 'Autori leht', book: 'Raamat või ajakiri', media: 'Meediaartikkel' },
  perWeek: 'p/näd',
  weeksShort: 'näd',
  needs: (a) => `Vajab: ${a}`,
  emptyTitle: 'Programme ei leitud',
  emptyBody: 'Proovi vähem filtreid või teist otsingut.',
  start: 'Alusta seda programmi',
  get: (a) => `Hangi: ${a}`,
  lockedBody: (a) =>
    `See programm kasutab lisa ${a}. Paigalda see, et alustada programmi nii, nagu on kirjeldatud. Seni saad seda siin lugeda.`,
  eliteWarning:
    'Mõeldud väga kogenud treenijatele. Kui treening on sulle uus, vali algajate programm.',
  week: 'Nädal',
  exercises: (n) => fill1('Harjutusi: {n}', n),
  rest: 'Puhkus',
  source: 'Allikas',
  sourceKind: 'Kust see pärineb',
  notVerified: 'Originaalväljaandega kontrollimata.',
  disclaimer:
    'Programmid on kirjeldatud nii, nagu allikas need avaldas. Nimetatud sportlased ja autorid ei loonud, ei kiitnud heaks ega kontrollinud neid ning Spotter ei ole nendega seotud.',
  weekdays: ['E', 'T', 'K', 'N', 'R', 'L', 'P'],
};

export const STRINGS: Record<LocaleId, TlStrings> = { en, uk, pl, lt, et };
