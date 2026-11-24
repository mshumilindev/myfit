import type { LocaleId } from '../../i18n';

/** Words of the cycle editor. They live in the chunk, not in the core i18n (add-on boundary). */
export interface EditorStrings {
  cycleSwitch: string;
  cycleSub: string;
  length: string;
  weeks: string;
  week: string;
  weekN: string;
  base: string;
  none: string;
  deload: string;
  test: string;
  peak: string;
  weekType: string;
  same: string;
  copyFrom: string;
  copyTitle: string;
  copyBody: string;
  copyDo: string;
  offTitle: string;
  offBody: string;
  offDo: string;
  cutTitle: string;
  cutBody: string;
  cutDo: string;
  cancel: string;
  loadType: string;
  kg: string;
  pct: string;
  weight: string;
  percent: string;
  hintMax: string;
  hintNoMax: string;
  reps: string;
  from: string;
  to: string;
  useRange: string;
  useOne: string;
}

const en: EditorStrings = {
  cycleSwitch: 'Weekly cycle',
  cycleSub: 'Different weeks: lighter, heavier, a test week. Off = every week is the same.',
  length: 'Cycle length',
  weeks: 'Cycle weeks',
  week: 'Week',
  weekN: 'Week {n}',
  base: 'Base',
  none: 'Normal',
  deload: 'Deload',
  test: 'Test',
  peak: 'Peak',
  weekType: 'Week type',
  same: 'Activities are the same every week.',
  copyFrom: 'Copy from another week',
  copyTitle: 'Copy week {from} into week {to}?',
  copyBody: 'The days of week {to} are replaced by those of week {from}. Its type stays.',
  copyDo: 'Copy',
  offTitle: 'Turn the cycle off?',
  offBody: 'Only week 1 stays. The other weeks are removed from this program.',
  offDo: 'Turn off',
  cutTitle: 'Shorten the cycle?',
  cutBody: 'Weeks {weeks} have exercises and will be removed.',
  cutDo: 'Shorten',
  cancel: 'Cancel',
  loadType: 'Load in',
  kg: 'kg',
  pct: '% of max',
  weight: 'Weight',
  percent: '% of max',
  hintMax: 'Max {max} kg → {kg} kg',
  hintNoMax: 'No max yet. Add one in More › Maxes, or it is worked out from your history.',
  reps: 'Reps',
  from: 'From',
  to: 'To',
  useRange: 'Use a range',
  useOne: 'Use one number',
};
const uk: EditorStrings = {
  cycleSwitch: 'Тижневий цикл',
  cycleSub: 'Різні тижні: легший, важчий, тестовий. Вимкнено = кожен тиждень однаковий.',
  length: 'Довжина циклу',
  weeks: 'Тижні циклу',
  week: 'Тиждень',
  weekN: 'Тиждень {n}',
  base: 'Базовий',
  none: 'Звичайний',
  deload: 'Розвантаження',
  test: 'Тест',
  peak: 'Пік',
  weekType: 'Тип тижня',
  same: 'Активності однакові щотижня.',
  copyFrom: 'Скопіювати з іншого тижня',
  copyTitle: 'Скопіювати тиждень {from} у тиждень {to}?',
  copyBody: 'Дні тижня {to} буде замінено днями тижня {from}. Його тип залишиться.',
  copyDo: 'Скопіювати',
  offTitle: 'Вимкнути цикл?',
  offBody: 'Лишиться тільки тиждень 1. Решту тижнів буде видалено з цієї програми.',
  offDo: 'Вимкнути',
  cutTitle: 'Скоротити цикл?',
  cutBody: 'У тижнях {weeks} є вправи, їх буде видалено.',
  cutDo: 'Скоротити',
  cancel: 'Скасувати',
  loadType: 'Навантаження в',
  kg: 'кг',
  pct: '% від максимуму',
  weight: 'Вага',
  percent: '% від максимуму',
  hintMax: 'Максимум {max} кг → {kg} кг',
  hintNoMax: 'Максимуму ще немає. Додай у Ще › Максимуми, або він порахується з історії.',
  reps: 'Повторення',
  from: 'Від',
  to: 'До',
  useRange: 'Діапазон',
  useOne: 'Одне число',
};
const pl: EditorStrings = {
  cycleSwitch: 'Cykl tygodniowy',
  cycleSub: 'Różne tygodnie: lżejszy, cięższy, testowy. Wyłączony = każdy tydzień taki sam.',
  length: 'Długość cyklu',
  weeks: 'Tygodnie cyklu',
  week: 'Tydzień',
  weekN: 'Tydzień {n}',
  base: 'Bazowy',
  none: 'Zwykły',
  deload: 'Odciążenie',
  test: 'Test',
  peak: 'Szczyt',
  weekType: 'Rodzaj tygodnia',
  same: 'Aktywności są takie same co tydzień.',
  copyFrom: 'Kopiuj z innego tygodnia',
  copyTitle: 'Skopiować tydzień {from} do tygodnia {to}?',
  copyBody: 'Dni tygodnia {to} zostaną zastąpione dniami tygodnia {from}. Jego rodzaj zostaje.',
  copyDo: 'Kopiuj',
  offTitle: 'Wyłączyć cykl?',
  offBody: 'Zostanie tylko tydzień 1. Pozostałe tygodnie znikną z tego programu.',
  offDo: 'Wyłącz',
  cutTitle: 'Skrócić cykl?',
  cutBody: 'Tygodnie {weeks} mają ćwiczenia i zostaną usunięte.',
  cutDo: 'Skróć',
  cancel: 'Anuluj',
  loadType: 'Obciążenie w',
  kg: 'kg',
  pct: '% maksimum',
  weight: 'Ciężar',
  percent: '% maksimum',
  hintMax: 'Maksimum {max} kg → {kg} kg',
  hintNoMax: 'Brak maksimum. Dodaj w Więcej › Maksimum albo wyliczymy z historii.',
  reps: 'Powtórzenia',
  from: 'Od',
  to: 'Do',
  useRange: 'Użyj zakresu',
  useOne: 'Jedna liczba',
};
const lt: EditorStrings = {
  cycleSwitch: 'Savaitinis ciklas',
  cycleSub: 'Skirtingos savaitės: lengvesnė, sunkesnė, testo. Išjungta = visos savaitės vienodos.',
  length: 'Ciklo ilgis',
  weeks: 'Ciklo savaitės',
  week: 'Savaitė',
  weekN: '{n} savaitė',
  base: 'Bazinė',
  none: 'Įprasta',
  deload: 'Atsipalaidavimo',
  test: 'Testo',
  peak: 'Piko',
  weekType: 'Savaitės tipas',
  same: 'Veiklos kas savaitę tos pačios.',
  copyFrom: 'Kopijuoti iš kitos savaitės',
  copyTitle: 'Kopijuoti {from} savaitę į {to} savaitę?',
  copyBody: '{to} savaitės dienos bus pakeistos {from} savaitės dienomis. Tipas lieka.',
  copyDo: 'Kopijuoti',
  offTitle: 'Išjungti ciklą?',
  offBody: 'Liks tik 1 savaitė. Kitos savaitės bus pašalintos iš šios programos.',
  offDo: 'Išjungti',
  cutTitle: 'Sutrumpinti ciklą?',
  cutBody: 'Savaitėse {weeks} yra pratimų, jie bus pašalinti.',
  cutDo: 'Sutrumpinti',
  cancel: 'Atšaukti',
  loadType: 'Krūvis',
  kg: 'kg',
  pct: '% maksimumo',
  weight: 'Svoris',
  percent: '% maksimumo',
  hintMax: 'Maksimumas {max} kg → {kg} kg',
  hintNoMax:
    'Maksimumo dar nėra. Pridėk skiltyje Daugiau › Maksimumai arba jis bus paskaičiuotas iš istorijos.',
  reps: 'Pakartojimai',
  from: 'Nuo',
  to: 'Iki',
  useRange: 'Naudoti intervalą',
  useOne: 'Vienas skaičius',
};
const et: EditorStrings = {
  cycleSwitch: 'Nädalatsükkel',
  cycleSub: 'Erinevad nädalad: kergem, raskem, testnädal. Väljas = iga nädal on sama.',
  length: 'Tsükli pikkus',
  weeks: 'Tsükli nädalad',
  week: 'Nädal',
  weekN: 'Nädal {n}',
  base: 'Põhi',
  none: 'Tavaline',
  deload: 'Kergendus',
  test: 'Test',
  peak: 'Tipp',
  weekType: 'Nädala tüüp',
  same: 'Tegevused on igal nädalal samad.',
  copyFrom: 'Kopeeri teisest nädalast',
  copyTitle: 'Kopeerida nädal {from} nädalasse {to}?',
  copyBody: 'Nädala {to} päevad asendatakse nädala {from} päevadega. Tüüp jääb.',
  copyDo: 'Kopeeri',
  offTitle: 'Lülitada tsükkel välja?',
  offBody: 'Alles jääb ainult nädal 1. Ülejäänud nädalad eemaldatakse sellest programmist.',
  offDo: 'Lülita välja',
  cutTitle: 'Lühendada tsüklit?',
  cutBody: 'Nädalatel {weeks} on harjutused ja need eemaldatakse.',
  cutDo: 'Lühenda',
  cancel: 'Tühista',
  loadType: 'Koormus',
  kg: 'kg',
  pct: '% maksimumist',
  weight: 'Kaal',
  percent: '% maksimumist',
  hintMax: 'Maksimum {max} kg → {kg} kg',
  hintNoMax: 'Maksimumi veel pole. Lisa menüüs Veel › Maksimumid või see arvutatakse ajaloost.',
  reps: 'Kordused',
  from: 'Alates',
  to: 'Kuni',
  useRange: 'Kasuta vahemikku',
  useOne: 'Üks arv',
};

export const EDITOR_STRINGS: Record<LocaleId, EditorStrings> = { en, uk, pl, lt, et };
