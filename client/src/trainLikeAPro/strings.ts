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
  readMore: string;
  readLess: string;
  /** What each split means, one sentence; the same for every program with that split. */
  splitInfo: Record<
    | 'full-body'
    | 'body-part'
    | 'push-pull-legs'
    | 'lift-per-day'
    | 'single-lift'
    | 'squat-plus'
    | 'daily',
    string
  >;
  disciplineInfo: Record<'bodybuilding' | 'strength' | 'powerlifting' | 'bodyweight', string>;
  aimedAt: (list: string) => string;
  daysFocus: (list: string) => string;
  mainWork: (list: string) => string;
  perSession: (n: number) => string;
  runsFor: (n: number) => string;
  weekdays: string[];
  /** Shown under Start when the trainer's program is the active one (the server refuses too). */
  heldHint: string;
  replaceTitle: string;
  replaceBody: (current: string) => string;
  replaceBtn: string;
  cancel: string;
  /** Created on this device, activation waits for the network. */
  queued: string;
  failed: string;
  /** The quiet row on Programs. */
  entrySub: string;
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
  readMore: 'Read more',
  readLess: 'Read less',
  splitInfo: {
    'full-body': 'Every session trains the whole body, with rest days in between.',
    'body-part':
      'Each day targets one or two muscle groups, so every muscle gets a hard session once or twice a week.',
    'push-pull-legs': 'The week is split into pushing days, pulling days and leg days.',
    'lift-per-day': 'Each day is built around one main lift, with supporting work after it.',
    'single-lift': 'The plan is built around a single lift that is trained again and again.',
    'squat-plus': 'The squat leads each session, with a few basic lifts added.',
    daily: 'You train every day, with short sessions.',
  },
  disciplineInfo: {
    bodybuilding:
      'Bodybuilding style: moderate to high reps and several exercises for each muscle.',
    strength: 'Strength style: heavy compound lifts and fewer reps.',
    powerlifting:
      'Powerlifting style: everything revolves around the squat, the bench press and the deadlift.',
    bodyweight: 'Bodyweight style: the work is done with your own body weight.',
  },
  aimedAt: (x) => 'Aimed at: {x}.'.replace('{x}', x),
  daysFocus: (x) => 'The days: {x}.'.replace('{x}', x),
  mainWork: (x) => 'Recurring exercises: {x}.'.replace('{x}', x),
  perSession: (n) => fill1('About {n} working sets per session.', n),
  runsFor: (n) => fill1('It runs for {n} weeks.', n),
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  heldHint: "Your trainer's program is active. It can't be replaced here.",
  replaceTitle: 'Replace your current program?',
  replaceBody: (n) =>
    '"{n}" is archived and your history stays. This program becomes your active one.'.replace(
      '{n}',
      n,
    ),
  replaceBtn: 'Replace and start',
  cancel: 'Cancel',
  queued: 'Saved on this device. It starts when you are online: tap Start again then.',
  failed: 'Could not start the program. Try again.',
  entrySub: 'Programs of famous athletes',
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
  readMore: 'Детальніше',
  readLess: 'Менше',
  splitInfo: {
    'full-body': 'Кожне тренування залучає все тіло, між ними дні відпочинку.',
    'body-part':
      'Кожен день присвячений одній-двом групам м’язів, тож кожен м’яз отримує важке тренування раз чи двічі на тиждень.',
    'push-pull-legs': 'Тиждень поділений на дні жимів, дні тяг і дні ніг.',
    'lift-per-day':
      'Кожен день будується навколо однієї головної вправи, після неї йде допоміжна робота.',
    'single-lift': 'План побудований навколо однієї вправи, яку тренують знову і знову.',
    'squat-plus': 'Присідання відкриває кожне тренування, до нього додано кілька базових вправ.',
    daily: 'Тренування щодня, короткими сесіями.',
  },
  disciplineInfo: {
    bodybuilding: 'Стиль бодібілдингу: помірні й великі повторення та кілька вправ на кожен м’яз.',
    strength: 'Силовий стиль: важкі базові вправи й менше повторень.',
    powerlifting: 'Стиль пауерліфтингу: усе навколо присідання, жиму лежачи й станової тяги.',
    bodyweight: 'Стиль з власною вагою: вправи виконуються з вагою вашого тіла.',
  },
  aimedAt: (x) => 'Ціль: {x}.'.replace('{x}', x),
  daysFocus: (x) => 'Дні: {x}.'.replace('{x}', x),
  mainWork: (x) => 'Вправи, що повторюються: {x}.'.replace('{x}', x),
  perSession: (n) => fill1('Близько {n} робочих підходів за тренування.', n),
  runsFor: (n) => fill1('Програма триває {n} тиж.', n),
  weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  heldHint: 'Активна програма від вашого тренера. Тут її замінити не можна.',
  replaceTitle: 'Замінити поточну програму?',
  replaceBody: (n) =>
    '«{n}» піде в архів, історія залишиться. Ця програма стане активною.'.replace('{n}', n),
  replaceBtn: 'Замінити й почати',
  cancel: 'Скасувати',
  queued:
    'Збережено на пристрої. Програма почнеться, коли ви будете онлайн: тоді натисніть старт ще раз.',
  failed: 'Не вдалося почати програму. Спробуйте ще раз.',
  entrySub: 'Програми відомих атлетів',
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
  readMore: 'Czytaj więcej',
  readLess: 'Mniej',
  splitInfo: {
    'full-body': 'Każdy trening obejmuje całe ciało, między treningami są dni odpoczynku.',
    'body-part':
      'Każdy dzień skupia się na jednej lub dwóch grupach mięśni, więc każdy mięsień dostaje mocny trening raz lub dwa razy w tygodniu.',
    'push-pull-legs': 'Tydzień jest podzielony na dni pchania, dni ciągnięcia i dni nóg.',
    'lift-per-day':
      'Każdy dzień opiera się na jednym głównym ćwiczeniu, po którym następuje praca uzupełniająca.',
    'single-lift': 'Plan opiera się na jednym ćwiczeniu, trenowanym raz za razem.',
    'squat-plus':
      'Przysiad otwiera każdy trening, a do niego dołączono kilka podstawowych ćwiczeń.',
    daily: 'Trenujesz codziennie, krótkimi sesjami.',
  },
  disciplineInfo: {
    bodybuilding:
      'Styl kulturystyczny: umiarkowane i wysokie powtórzenia oraz kilka ćwiczeń na każdy mięsień.',
    strength: 'Styl siłowy: ciężkie ćwiczenia wielostawowe i mniej powtórzeń.',
    powerlifting:
      'Styl trójboju siłowego: wszystko kręci się wokół przysiadu, wyciskania leżąc i martwego ciągu.',
    bodyweight: 'Styl z masą własnego ciała: ćwiczenia wykonuje się z ciężarem własnego ciała.',
  },
  aimedAt: (x) => 'Cel: {x}.'.replace('{x}', x),
  daysFocus: (x) => 'Dni: {x}.'.replace('{x}', x),
  mainWork: (x) => 'Powtarzające się ćwiczenia: {x}.'.replace('{x}', x),
  perSession: (n) => fill1('Około {n} serii roboczych na trening.', n),
  runsFor: (n) => fill1('Program trwa {n} tyg.', n),
  weekdays: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'],
  heldHint: 'Aktywny jest program od Twojego trenera. Nie można go tu zastąpić.',
  replaceTitle: 'Zastąpić obecny program?',
  replaceBody: (n) =>
    '„{n}” trafi do archiwum, historia zostanie. Ten program stanie się aktywny.'.replace('{n}', n),
  replaceBtn: 'Zastąp i zacznij',
  cancel: 'Anuluj',
  queued: 'Zapisano na urządzeniu. Ruszy, gdy będziesz online: wtedy użyj startu jeszcze raz.',
  failed: 'Nie udało się rozpocząć programu. Spróbuj ponownie.',
  entrySub: 'Programy znanych sportowców',
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
  readMore: 'Skaityti daugiau',
  readLess: 'Mažiau',
  splitInfo: {
    'full-body': 'Kiekviena treniruotė apima visą kūną, tarp jų – poilsio dienos.',
    'body-part':
      'Kiekviena diena skirta vienai ar dviem raumenų grupėms, todėl kiekvienas raumuo gauna sunkią treniruotę kartą ar du per savaitę.',
    'push-pull-legs': 'Savaitė padalyta į stūmimo, traukimo ir kojų dienas.',
    'lift-per-day':
      'Kiekviena diena sukurta aplink vieną pagrindinį pratimą, po jo – papildomas darbas.',
    'single-lift': 'Planas sukurtas aplink vieną pratimą, kuris treniruojamas vėl ir vėl.',
    'squat-plus':
      'Kiekvieną treniruotę pradeda prisitūpimai, prie jų pridėta keletas pagrindinių pratimų.',
    daily: 'Treniruojamasi kasdien trumpomis sesijomis.',
  },
  disciplineInfo: {
    bodybuilding:
      'Kultūrizmo stilius: vidutinis ir didelis pakartojimų skaičius bei keli pratimai kiekvienam raumeniui.',
    strength: 'Jėgos stilius: sunkūs pagrindiniai pratimai ir mažiau pakartojimų.',
    powerlifting:
      'Jėgos trikovės stilius: viskas sukasi apie prisitūpimus, spaudimą gulint ir trauką.',
    bodyweight: 'Stilius su savo svoriu: pratimai atliekami su savo kūno svoriu.',
  },
  aimedAt: (x) => 'Tikslas: {x}.'.replace('{x}', x),
  daysFocus: (x) => 'Dienos: {x}.'.replace('{x}', x),
  mainWork: (x) => 'Pasikartojantys pratimai: {x}.'.replace('{x}', x),
  perSession: (n) => fill1('Maždaug {n} darbinių serijų per treniruotę.', n),
  runsFor: (n) => fill1('Programa trunka {n} sav.', n),
  weekdays: ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'],
  heldHint: 'Aktyvi jūsų trenerio programa. Čia jos pakeisti negalima.',
  replaceTitle: 'Pakeisti dabartinę programą?',
  replaceBody: (n) =>
    '„{n}“ bus archyvuota, istorija liks. Ši programa taps aktyvia.'.replace('{n}', n),
  replaceBtn: 'Pakeisti ir pradėti',
  cancel: 'Atšaukti',
  queued:
    'Išsaugota įrenginyje. Ji prasidės, kai būsite prisijungę: tada dar kartą paspauskite pradžią.',
  failed: 'Nepavyko pradėti programos. Bandykite dar kartą.',
  entrySub: 'Žinomų sportininkų programos',
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
  readMore: 'Loe edasi',
  readLess: 'Vähem',
  splitInfo: {
    'full-body': 'Iga trenn koormab kogu keha, treeningute vahel on puhkepäevad.',
    'body-part':
      'Iga päev keskendub ühele-kahele lihasgrupile, nii saab iga lihas kord või paar korda nädalas tugeva treeningu.',
    'push-pull-legs': 'Nädal on jagatud tõukepäevadeks, tõmbepäevadeks ja jalapäevadeks.',
    'lift-per-day': 'Iga päev on üles ehitatud ühe põhiharjutuse ümber, sellele järgneb abitöö.',
    'single-lift': 'Plaan on üles ehitatud ühe harjutuse ümber, mida treenitakse korduvalt.',
    'squat-plus': 'Kükk avab iga treeningu, lisatud on mõned põhiharjutused.',
    daily: 'Treenid iga päev, lühikeste seanssidega.',
  },
  disciplineInfo: {
    bodybuilding:
      'Kulturismi stiil: mõõdukad ja kõrged kordused ning mitu harjutust iga lihase jaoks.',
    strength: 'Jõustiil: rasked põhiharjutused ja vähem kordusi.',
    powerlifting: 'Jõutõstmise stiil: kõik keerleb kükkide, lamades surumise ja jõutõmbe ümber.',
    bodyweight: 'Keharaskuse stiil: harjutusi tehakse oma keharaskusega.',
  },
  aimedAt: (x) => 'Eesmärk: {x}.'.replace('{x}', x),
  daysFocus: (x) => 'Päevad: {x}.'.replace('{x}', x),
  mainWork: (x) => 'Korduvad harjutused: {x}.'.replace('{x}', x),
  perSession: (n) => fill1('Umbes {n} töösarja treeningu kohta.', n),
  runsFor: (n) => fill1('Programm kestab {n} näd.', n),
  weekdays: ['E', 'T', 'K', 'N', 'R', 'L', 'P'],
  heldHint: 'Aktiivne on teie treeneri programm. Siin seda asendada ei saa.',
  replaceTitle: 'Kas asendada praegune programm?',
  replaceBody: (n) =>
    '„{n}” arhiveeritakse, ajalugu jääb alles. See programm muutub aktiivseks.'.replace('{n}', n),
  replaceBtn: 'Asenda ja alusta',
  cancel: 'Tühista',
  queued: 'Salvestatud seadmesse. See algab, kui olete võrgus: siis vajutage alustamist uuesti.',
  failed: 'Programmi alustamine ebaõnnestus. Proovige uuesti.',
  entrySub: 'Kuulsate sportlaste programmid',
};

export const STRINGS: Record<LocaleId, TlStrings> = { en, uk, pl, lt, et };
