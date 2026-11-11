import type { LocaleId } from '../i18n';

export interface PlannerStrings {
  name: string;
  emptyTitle: string;
  emptyBody: string;
  add: string;
  save: string;
  cancel: string;
  del: string;
  delTitle: string;
  delBody: string;
  newPlan: string;
  editPlan: string;
  titleLabel: string;
  titleHint: string;
  date: string;
  starts: string;
  hour: string;
  minute: string;
  repeats: string;
  repeat: {
    none: string;
    daily: string;
    weekly: string;
    weekdays: string;
    biweekly: string;
    monthly: string;
  };
  remind: string;
  quiet: string;
  ring: string;
  lead: string;
  leadOptions: { min: number; label: string }[];
  colour: string;
  colours: Record<string, string>;
  upcoming: string;
  today: string;
  tomorrow: string;
  nothingSoon: string;
}

/** Planner's own words live in its chunk, not in the core i18n (add-on boundary). */
export const STRINGS: Record<LocaleId, PlannerStrings> = {
  en: {
    name: 'Planner',
    emptyTitle: 'No plans yet',
    emptyBody:
      'Add a plan and Spotter reminds you before it starts. Nothing is added to your history.',
    add: 'Add plan',
    save: 'Save',
    cancel: 'Cancel',
    del: 'Delete',
    delTitle: 'Delete this plan?',
    delBody: 'The plan and its reminders are removed. Nothing in your history changes.',
    newPlan: 'New plan',
    editPlan: 'Edit plan',
    titleLabel: 'Title',
    titleHint: 'What are you planning?',
    date: 'Date',
    starts: 'Starts',
    hour: 'Hour',
    minute: 'Minute',
    repeats: 'Repeats',
    repeat: {
      none: 'Does not repeat',
      daily: 'Every day',
      weekly: 'Every week',
      weekdays: 'Every weekday',
      biweekly: 'Every 2 weeks',
      monthly: 'Every month',
    },
    remind: 'Reminder',
    quiet: 'Quiet',
    ring: 'Persistent',
    lead: 'Remind me before',
    leadOptions: [
      { min: 0, label: 'At start' },
      { min: 15, label: '15 min' },
      { min: 30, label: '30 min' },
      { min: 60, label: '1 hour' },
      { min: 120, label: '2 hours' },
      { min: 1440, label: '1 day' },
    ],
    colour: 'Colour',
    colours: {
      accent: 'Blue',
      ok: 'Green',
      warmup: 'Orange',
      danger: 'Red',
      sleep: 'Teal',
      neutral: 'Grey',
    },
    upcoming: 'Next 14 days',
    today: 'Today',
    tomorrow: 'Tomorrow',
    nothingSoon: 'Nothing planned in the next 14 days',
  },
  uk: {
    name: 'Планувальник',
    emptyTitle: 'Планів ще немає',
    emptyBody:
      'Додайте план, і Spotter нагадає перед його початком. Нічого не додається до вашої історії.',
    add: 'Додати план',
    save: 'Зберегти',
    cancel: 'Скасувати',
    del: 'Видалити',
    delTitle: 'Видалити цей план?',
    delBody: 'План і його нагадування буде видалено. Ваша історія не змінюється.',
    newPlan: 'Новий план',
    editPlan: 'Редагувати план',
    titleLabel: 'Назва',
    titleHint: 'Що плануєте?',
    date: 'Дата',
    starts: 'Початок',
    hour: 'Година',
    minute: 'Хвилини',
    repeats: 'Повторення',
    repeat: {
      none: 'Не повторюється',
      daily: 'Щодня',
      weekly: 'Щотижня',
      weekdays: 'Щобудня',
      biweekly: 'Раз на 2 тижні',
      monthly: 'Щомісяця',
    },
    remind: 'Нагадування',
    quiet: 'Тихе',
    ring: 'Наполегливе',
    lead: 'Нагадати за',
    leadOptions: [
      { min: 0, label: 'На початку' },
      { min: 15, label: '15 хв' },
      { min: 30, label: '30 хв' },
      { min: 60, label: '1 год' },
      { min: 120, label: '2 год' },
      { min: 1440, label: '1 день' },
    ],
    colour: 'Колір',
    colours: {
      accent: 'Синій',
      ok: 'Зелений',
      warmup: 'Помаранчевий',
      danger: 'Червоний',
      sleep: 'Бірюзовий',
      neutral: 'Сірий',
    },
    upcoming: 'Найближчі 14 днів',
    today: 'Сьогодні',
    tomorrow: 'Завтра',
    nothingSoon: 'На найближчі 14 днів нічого не заплановано',
  },
  pl: {
    name: 'Planer',
    emptyTitle: 'Nie ma jeszcze planów',
    emptyBody:
      'Dodaj plan, a Spotter przypomni o nim przed startem. Nic nie trafia do Twojej historii.',
    add: 'Dodaj plan',
    save: 'Zapisz',
    cancel: 'Anuluj',
    del: 'Usuń',
    delTitle: 'Usunąć ten plan?',
    delBody: 'Plan i jego przypomnienia zostaną usunięte. Twoja historia się nie zmieni.',
    newPlan: 'Nowy plan',
    editPlan: 'Edytuj plan',
    titleLabel: 'Nazwa',
    titleHint: 'Co planujesz?',
    date: 'Data',
    starts: 'Start',
    hour: 'Godzina',
    minute: 'Minuta',
    repeats: 'Powtarzanie',
    repeat: {
      none: 'Nie powtarza się',
      daily: 'Codziennie',
      weekly: 'Co tydzień',
      weekdays: 'W dni robocze',
      biweekly: 'Co 2 tygodnie',
      monthly: 'Co miesiąc',
    },
    remind: 'Przypomnienie',
    quiet: 'Ciche',
    ring: 'Natarczywe',
    lead: 'Przypomnij przed',
    leadOptions: [
      { min: 0, label: 'O starcie' },
      { min: 15, label: '15 min' },
      { min: 30, label: '30 min' },
      { min: 60, label: '1 godz.' },
      { min: 120, label: '2 godz.' },
      { min: 1440, label: '1 dzień' },
    ],
    colour: 'Kolor',
    colours: {
      accent: 'Niebieski',
      ok: 'Zielony',
      warmup: 'Pomarańczowy',
      danger: 'Czerwony',
      sleep: 'Turkusowy',
      neutral: 'Szary',
    },
    upcoming: 'Najbliższe 14 dni',
    today: 'Dziś',
    tomorrow: 'Jutro',
    nothingSoon: 'Nic nie zaplanowano na najbliższe 14 dni',
  },
  lt: {
    name: 'Planuoklis',
    emptyTitle: 'Planų dar nėra',
    emptyBody:
      'Pridėkite planą, o Spotter primins prieš jam prasidedant. Niekas nepridedama prie jūsų istorijos.',
    add: 'Pridėti planą',
    save: 'Išsaugoti',
    cancel: 'Atšaukti',
    del: 'Ištrinti',
    delTitle: 'Ištrinti šį planą?',
    delBody: 'Planas ir jo priminimai bus pašalinti. Jūsų istorija nesikeičia.',
    newPlan: 'Naujas planas',
    editPlan: 'Redaguoti planą',
    titleLabel: 'Pavadinimas',
    titleHint: 'Ką planuojate?',
    date: 'Data',
    starts: 'Pradžia',
    hour: 'Valanda',
    minute: 'Minutė',
    repeats: 'Kartojasi',
    repeat: {
      none: 'Nesikartoja',
      daily: 'Kasdien',
      weekly: 'Kas savaitę',
      weekdays: 'Darbo dienomis',
      biweekly: 'Kas 2 savaites',
      monthly: 'Kas mėnesį',
    },
    remind: 'Priminimas',
    quiet: 'Tylus',
    ring: 'Atkaklus',
    lead: 'Priminti prieš',
    leadOptions: [
      { min: 0, label: 'Pradžioje' },
      { min: 15, label: '15 min.' },
      { min: 30, label: '30 min.' },
      { min: 60, label: '1 val.' },
      { min: 120, label: '2 val.' },
      { min: 1440, label: '1 d.' },
    ],
    colour: 'Spalva',
    colours: {
      accent: 'Mėlyna',
      ok: 'Žalia',
      warmup: 'Oranžinė',
      danger: 'Raudona',
      sleep: 'Žalsvai mėlyna',
      neutral: 'Pilka',
    },
    upcoming: 'Artimiausios 14 dienų',
    today: 'Šiandien',
    tomorrow: 'Rytoj',
    nothingSoon: 'Artimiausias 14 dienų nieko nesuplanuota',
  },
  et: {
    name: 'Planeerija',
    emptyTitle: 'Plaane pole veel',
    emptyBody:
      'Lisa plaan ja Spotter tuletab seda enne algust meelde. Midagi ei lisata sinu ajalukku.',
    add: 'Lisa plaan',
    save: 'Salvesta',
    cancel: 'Tühista',
    del: 'Kustuta',
    delTitle: 'Kas kustutada see plaan?',
    delBody: 'Plaan ja selle meeldetuletused eemaldatakse. Sinu ajalugu ei muutu.',
    newPlan: 'Uus plaan',
    editPlan: 'Muuda plaani',
    titleLabel: 'Pealkiri',
    titleHint: 'Mida sa plaanid?',
    date: 'Kuupäev',
    starts: 'Algus',
    hour: 'Tund',
    minute: 'Minut',
    repeats: 'Kordub',
    repeat: {
      none: 'Ei kordu',
      daily: 'Iga päev',
      weekly: 'Iga nädal',
      weekdays: 'Tööpäeviti',
      biweekly: 'Iga 2 nädala tagant',
      monthly: 'Iga kuu',
    },
    remind: 'Meeldetuletus',
    quiet: 'Vaikne',
    ring: 'Püsiv',
    lead: 'Tuleta meelde enne',
    leadOptions: [
      { min: 0, label: 'Alguses' },
      { min: 15, label: '15 min' },
      { min: 30, label: '30 min' },
      { min: 60, label: '1 tund' },
      { min: 120, label: '2 tundi' },
      { min: 1440, label: '1 päev' },
    ],
    colour: 'Värv',
    colours: {
      accent: 'Sinine',
      ok: 'Roheline',
      warmup: 'Oranž',
      danger: 'Punane',
      sleep: 'Türkiis',
      neutral: 'Hall',
    },
    upcoming: 'Järgmised 14 päeva',
    today: 'Täna',
    tomorrow: 'Homme',
    nothingSoon: 'Järgmise 14 päeva jooksul pole midagi planeeritud',
  },
};
