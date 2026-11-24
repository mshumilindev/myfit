import type { LocaleId } from '../i18n';

/** Words of the drop-part editor. Set types' own words live in its chunk, not in the core i18n (add-on boundary). */
export interface SetTypesStrings {
  noteA: string;
  noteStrong: string;
  noteB: string;
  addDrop: string;
  totals: (reps: number, kg: string) => string;
  reverseNote: string;
}

const en: SetTypesStrings = {
  noteA: 'A drop or reverse drop is still ',
  noteStrong: 'one set',
  noteB: '. Its parts are drops, logged one after another with no break in between.',
  addDrop: 'Add another drop',
  totals: (reps: number, kg: string) => `${reps} reps · ${kg}`,
  reverseNote:
    'Reverse means the weight is expected to climb and the reps to fall. The app doesn’t enforce it — if a drop breaks the pattern it is simply saved as entered.',
};

const uk: SetTypesStrings = {
  noteA: 'Дроп чи зворотний дроп — це все ще ',
  noteStrong: 'один підхід',
  noteB: '. Його частини — дропи, залоговані одна за одною без перерви.',
  addDrop: 'Додати ще дроп',
  totals: (reps: number, kg: string) => `${reps} повт. · ${kg}`,
  reverseNote:
    'Зворотний означає, що вага має рости, а повтори — падати. Додаток цього не вимагає: якщо дроп ламає патерн, він просто зберігається як введено.',
};

const pl: SetTypesStrings = {
  noteA: 'Drop lub odwrotny drop to wciąż ',
  noteStrong: 'jedna seria',
  noteB: '. Jej części to dropy, logowane jedna po drugiej bez przerwy.',
  addDrop: 'Dodaj kolejny drop',
  totals: (reps: number, kg: string) => `${reps} powt. · ${kg}`,
  reverseNote:
    'Odwrotny znaczy, że ciężar ma rosnąć, a powtórzenia spadać. Aplikacja tego nie wymusza — drop łamiący wzorzec jest po prostu zapisywany tak, jak go wpisano.',
};

const et: SetTypesStrings = {
  noteA: 'Dropp või pöörddropp on ikkagi ',
  noteStrong: 'üks seeria',
  noteB: '. Selle osad on dropid, logitud üksteise järel ilma pausita.',
  addDrop: 'Lisa veel üks dropp',
  totals: (reps: number, kg: string) => `${reps} kordust · ${kg}`,
  reverseNote:
    'Pöörd tähendab, et raskus peaks tõusma ja kordused langema. Äpp seda ei nõua — mustrit murdev dropp salvestatakse lihtsalt nii, nagu sisestati.',
};

const lt: SetTypesStrings = {
  noteA: 'Dropas ar atvirkštinis dropas vis tiek yra ',
  noteStrong: 'viena serija',
  noteB: '. Jos dalys — dropai, registruojami vienas po kito be pertraukos.',
  addDrop: 'Pridėti dar vieną dropą',
  totals: (reps: number, kg: string) => `${reps} kart. · ${kg}`,
  reverseNote:
    'Atvirkštinis reiškia, kad svoris turėtų kilti, o kartojimai kristi. Programa to neverčia — jei dropas laužo šabloną, jis tiesiog išsaugomas kaip įvestas.',
};

export const STRINGS: Record<LocaleId, SetTypesStrings> = { en, uk, pl, et, lt };
