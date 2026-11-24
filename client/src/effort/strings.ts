import type { LocaleId } from '../i18n';

/** Words of the effort (RPE) entry. RPE / RIR's own words live in its chunk, not in the core i18n (add-on boundary). */
export interface EffortStrings {
  label: string;
  none: string;
  hint: (v: number) => string;
  estHint: (v: string) => string;
}

const en: EffortStrings = {
  label: 'Effort (RPE)',
  none: 'Skip',
  hint: (v: number) =>
    v >= 10
      ? 'Max — nothing left in the tank'
      : v >= 9
        ? '1 more rep was possible'
        : v >= 8
          ? '2 more reps were possible'
          : v >= 7
            ? '3 more reps were possible'
            : v >= 6
              ? 'Easy — 4+ reps left'
              : 'How hard the set felt, 6–10. Optional — tap a number to track it.',
  estHint: (v: string) =>
    `Estimated ~${v} from your history, recovery and today’s sets — tap to correct.`,
};

const uk: EffortStrings = {
  label: 'Зусилля (RPE)',
  none: 'Без',
  hint: (v) =>
    v >= 10
      ? 'Максимум — більше жодного'
      : v >= 9
        ? 'Міг би ще 1 повтор'
        : v >= 8
          ? 'Міг би ще 2 повтори'
          : v >= 7
            ? 'Міг би ще 3 повтори'
            : v >= 6
              ? 'Легко — лишалось 4+ повтори'
              : 'Наскільки важким був підхід, 6–10. Необовʼязково — тапни число, щоб відстежувати.',
  estHint: (v) =>
    `Оцінка ~${v} з історії, відновлення і сьогоднішніх сетів — тапни, щоб виправити.`,
};

const pl: EffortStrings = {
  label: 'Wysiłek (RPE)',
  none: 'Pomiń',
  hint: (v) =>
    v >= 10
      ? 'Maksimum — nic w zapasie'
      : v >= 9
        ? 'W zapasie 1 powtórzenie'
        : v >= 8
          ? 'W zapasie 2 powtórzenia'
          : v >= 7
            ? 'W zapasie 3 powtórzenia'
            : v >= 6
              ? 'Lekko — w zapasie 4+ powtórzenia'
              : 'Jak ciężka była seria, 6–10. Opcjonalnie — stuknij liczbę, by to śledzić.',
  estHint: (v) =>
    `Szacunek ~${v} z historii, regeneracji i dzisiejszych serii — stuknij, by poprawić.`,
};

const et: EffortStrings = {
  label: 'Pingutus (RPE)',
  none: 'Jäta',
  hint: (v) =>
    v >= 10
      ? 'Maksimum — midagi ei jäänud'
      : v >= 9
        ? 'Varus 1 kordus'
        : v >= 8
          ? 'Varus 2 kordust'
          : v >= 7
            ? 'Varus 3 kordust'
            : v >= 6
              ? 'Kerge — varus 4+ kordust'
              : 'Kui raske seeria tundus, 6–10. Valikuline — puuduta numbrit, et jälgida.',
  estHint: (v) =>
    `Hinnang ~${v} ajaloo, taastumise ja tänaste seeriate põhjal — puuduta, et parandada.`,
};

const lt: EffortStrings = {
  label: 'Pastangos (RPE)',
  none: 'Be',
  hint: (v) =>
    v >= 10
      ? 'Maksimumas — nieko nebeliko'
      : v >= 9
        ? 'Liko 1 pakartojimas'
        : v >= 8
          ? 'Liko 2 pakartojimai'
          : v >= 7
            ? 'Liko 3 pakartojimai'
            : v >= 6
              ? 'Lengva — liko 4+ pakartojimai'
              : 'Kaip sunkus buvo priėjimas, 6–10. Neprivaloma — bakstelėk skaičių, kad sektum.',
  estHint: (v) =>
    `Įvertinta ~${v} pagal istoriją, atsigavimą ir šiandienos priėjimus — bakstelėk, kad pataisytum.`,
};

export const STRINGS: Record<LocaleId, EffortStrings> = { en, uk, pl, et, lt };
