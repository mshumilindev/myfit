import type { LocaleId } from '../i18n';

/** Words of the Maxes page. Periodization's own words live in its chunk, not in the core i18n (add-on boundary). */
export interface MaxesStrings {
  name: string;
  sub: string;
  back: string;
  used: string;
  history: string;
  typed: string;
  none: string;
  setIt: string;
  note: string;
  emptyTitle: string;
  emptyBody: string;
  add: string;
  source: string;
  fromHistory: string;
  typeIt: string;
  estimated: string;
  noEstimate: string;
  maxLabel: string;
  useEstimate: string;
  save: string;
  exercise: string;
  exerciseHint: string;
  next: string;
  saveFailed: string;
  targetPct: string;
  targetNoMax: string;
  noMaxHint: string;
  repsRange: string;
  kg: string;
}

const en: MaxesStrings = {
  name: 'Maxes',
  sub: 'Turns “% of max” into kg at session start',
  back: 'Back',
  used: 'Used by your programs',
  history: 'From history',
  typed: 'You set this',
  none: 'No max yet',
  setIt: 'Set',
  note: 'Estimates come from your best recent sets. Typing a max replaces the estimate.',
  emptyTitle: 'No maxes yet',
  emptyBody: 'Log a few heavy sets and Spotter estimates them for you. Or enter one by hand.',
  add: 'Add a max',
  source: 'Source',
  fromHistory: 'From history',
  typeIt: 'Type it',
  estimated: 'Estimated max',
  noEstimate: 'No estimate yet. Log a few heavy sets, or type a max.',
  maxLabel: 'Max',
  useEstimate: 'Use the estimate again ({kg} kg)',
  save: 'Save',
  exercise: 'Exercise',
  exerciseHint: 'The name as in your programs, for example Barbell Squat',
  next: 'Next',
  saveFailed: "Couldn't save. Check your connection and try again.",
  targetPct: '{pct}% · {kg} kg',
  targetNoMax: '{pct}% of max',
  noMaxHint: 'No max yet. Add one in More › Maxes.',
  repsRange: '{range} reps',
  kg: 'kg',
};

const uk: MaxesStrings = {
  name: 'Максимуми',
  sub: 'Перетворюють «% від максимуму» на кг на старті тренування',
  back: 'Назад',
  used: 'Для твоїх програм',
  history: 'З історії',
  typed: 'Ти задав(-ла) це',
  none: 'Максимуму ще немає',
  setIt: 'Задати',
  note: 'Оцінка береться з найкращих недавніх підходів. Введений максимум замінює оцінку.',
  emptyTitle: 'Максимумів ще немає',
  emptyBody: 'Запиши кілька важких підходів, і Spotter оцінить їх сам. Або введи максимум вручну.',
  add: 'Додати максимум',
  source: 'Джерело',
  fromHistory: 'З історії',
  typeIt: 'Ввести',
  estimated: 'Оцінений максимум',
  noEstimate: 'Оцінки ще немає. Запиши кілька важких підходів або введи максимум.',
  maxLabel: 'Максимум',
  useEstimate: 'Знову взяти оцінку ({kg} кг)',
  save: 'Зберегти',
  exercise: 'Вправа',
  exerciseHint: 'Назва, як у твоїх програмах, наприклад Barbell Squat',
  next: 'Далі',
  saveFailed: 'Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.',
  targetPct: '{pct}% · {kg} кг',
  targetNoMax: '{pct}% від максимуму',
  noMaxHint: 'Максимуму ще немає. Додай у Ще › Максимуми.',
  repsRange: '{range} повторів',
  kg: 'кг',
};

const pl: MaxesStrings = {
  name: 'Maksima',
  sub: 'Zamieniają „% maksimum” na kg na starcie treningu',
  back: 'Wstecz',
  used: 'Używane w Twoich programach',
  history: 'Z historii',
  typed: 'Ustawione przez Ciebie',
  none: 'Brak maksimum',
  setIt: 'Ustaw',
  note: 'Szacunek pochodzi z Twoich najlepszych ostatnich serii. Wpisane maksimum zastępuje szacunek.',
  emptyTitle: 'Brak maksimów',
  emptyBody: 'Zapisz kilka ciężkich serii, a Spotter je oszacuje. Albo wpisz maksimum ręcznie.',
  add: 'Dodaj maksimum',
  source: 'Źródło',
  fromHistory: 'Z historii',
  typeIt: 'Wpisz',
  estimated: 'Szacowane maksimum',
  noEstimate: 'Brak szacunku. Zapisz kilka ciężkich serii albo wpisz maksimum.',
  maxLabel: 'Maksimum',
  useEstimate: 'Użyj znów szacunku ({kg} kg)',
  save: 'Zapisz',
  exercise: 'Ćwiczenie',
  exerciseHint: 'Nazwa jak w Twoich programach, np. Barbell Squat',
  next: 'Dalej',
  saveFailed: 'Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.',
  targetPct: '{pct}% · {kg} kg',
  targetNoMax: '{pct}% maksimum',
  noMaxHint: 'Brak maksimum. Dodaj w Więcej › Maksima.',
  repsRange: '{range} powt.',
  kg: 'kg',
};

const lt: MaxesStrings = {
  name: 'Maksimumai',
  sub: 'Paverčia „% nuo maksimumo“ kilogramais treniruotės pradžioje',
  back: 'Atgal',
  used: 'Tavo programoms',
  history: 'Iš istorijos',
  typed: 'Nustatei pats',
  none: 'Maksimumo dar nėra',
  setIt: 'Nustatyti',
  note: 'Įvertis imamas iš geriausių pastarųjų serijų. Įvestas maksimumas pakeičia įvertį.',
  emptyTitle: 'Maksimumų dar nėra',
  emptyBody:
    'Užfiksuok kelias sunkias serijas ir Spotter juos įvertins. Arba įvesk maksimumą ranka.',
  add: 'Pridėti maksimumą',
  source: 'Šaltinis',
  fromHistory: 'Iš istorijos',
  typeIt: 'Įvesti',
  estimated: 'Įvertintas maksimumas',
  noEstimate: 'Įverčio dar nėra. Užfiksuok kelias sunkias serijas arba įvesk maksimumą.',
  maxLabel: 'Maksimumas',
  useEstimate: 'Vėl naudoti įvertį ({kg} kg)',
  save: 'Išsaugoti',
  exercise: 'Pratimas',
  exerciseHint: 'Pavadinimas kaip tavo programose, pvz., Barbell Squat',
  next: 'Toliau',
  saveFailed: 'Nepavyko išsaugoti. Patikrink ryšį ir bandyk dar kartą.',
  targetPct: '{pct}% · {kg} kg',
  targetNoMax: '{pct}% nuo maksimumo',
  noMaxHint: 'Maksimumo dar nėra. Pridėk skiltyje Daugiau › Maksimumai.',
  repsRange: '{range} pakartojimų',
  kg: 'kg',
};

const et: MaxesStrings = {
  name: 'Maksimumid',
  sub: 'Muudavad „% maksimumist” treeningu alguses kilogrammideks',
  back: 'Tagasi',
  used: 'Sinu programmides kasutusel',
  history: 'Ajaloost',
  typed: 'Sinu määratud',
  none: 'Maksimumi veel pole',
  setIt: 'Määra',
  note: 'Hinnang tuleb sinu parimatest viimastest seeriatest. Sisestatud maksimum asendab hinnangu.',
  emptyTitle: 'Maksimume veel pole',
  emptyBody: 'Logi mõned rasked seeriad ja Spotter hindab need ise. Või sisesta maksimum käsitsi.',
  add: 'Lisa maksimum',
  source: 'Allikas',
  fromHistory: 'Ajaloost',
  typeIt: 'Sisesta',
  estimated: 'Hinnanguline maksimum',
  noEstimate: 'Hinnangut veel pole. Logi mõned rasked seeriad või sisesta maksimum.',
  maxLabel: 'Maksimum',
  useEstimate: 'Kasuta uuesti hinnangut ({kg} kg)',
  save: 'Salvesta',
  exercise: 'Harjutus',
  exerciseHint: 'Nimi nagu sinu programmides, nt Barbell Squat',
  next: 'Edasi',
  saveFailed: 'Salvestamine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.',
  targetPct: '{pct}% · {kg} kg',
  targetNoMax: '{pct}% maksimumist',
  noMaxHint: 'Maksimumi veel pole. Lisa menüüs Veel › Maksimumid.',
  repsRange: '{range} kordust',
  kg: 'kg',
};

export const STRINGS: Record<LocaleId, MaxesStrings> = { en, uk, pl, lt, et };

export const fill = (s: string, v: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
