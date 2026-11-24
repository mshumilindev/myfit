import type { LocaleId } from '../i18n';

/** Words of the "Superset with…" sheet. Supersets' own words live in its chunk, not in the core i18n (add-on boundary). */
export interface SupersetsStrings {
  supersetWithBody: (name: string) => string;
  thisOne: string;
  supersetKeepNote: string;
  groupAs: (l: string) => string;
}

const en: SupersetsStrings = {
  supersetWithBody: (name: string) =>
    `Pick the exercises to alternate with ${name}. They move together and are logged in rounds.`,
  thisOne: 'this one',
  supersetKeepNote:
    'Both keep every set already logged. Round count follows the exercise with the most sets; the shorter one simply has an empty round.',
  groupAs: (l: string) => `Group as ${l}`,
};

const uk: SupersetsStrings = {
  supersetWithBody: (name: string) =>
    `Обери вправи, що чергуються з «${name}». Вони рухаються разом і логуються раундами.`,
  thisOne: 'ця вправа',
  supersetKeepNote:
    'Обидві зберігають усі вже залоговані підходи. Кількість раундів іде за вправою з найбільшою кількістю підходів; коротша просто має порожній раунд.',
  groupAs: (l: string) => `Згрупувати як ${l}`,
};

const pl: SupersetsStrings = {
  supersetWithBody: (name: string) =>
    `Wybierz ćwiczenia wykonywane na przemian z „${name}”. Poruszają się razem i są logowane w rundach.`,
  thisOne: 'to ćwiczenie',
  supersetKeepNote:
    'Oba zachowują każdą zalogowaną serię. Liczba rund podąża za ćwiczeniem z największą liczbą serii; krótsze ma po prostu pustą rundę.',
  groupAs: (l: string) => `Grupuj jako ${l}`,
};

const et: SupersetsStrings = {
  supersetWithBody: (name: string) =>
    `Vali harjutused, mida vaheldada harjutusega „${name}“. Need liiguvad koos ja logitakse ringidena.`,
  thisOne: 'see harjutus',
  supersetKeepNote:
    'Mõlemad säilitavad kõik juba logitud seeriad. Ringide arv järgib enim seeriatega harjutust; lühemal on lihtsalt tühi ring.',
  groupAs: (l: string) => `Rühmita kui ${l}`,
};

const lt: SupersetsStrings = {
  supersetWithBody: (name: string) =>
    `Pasirink pratimus, kaitaliojamus su „${name}“. Jie juda kartu ir registruojami ratais.`,
  thisOne: 'šis pratimas',
  supersetKeepNote:
    'Abu išsaugo visas jau užregistruotas serijas. Ratų skaičius seka pratimą su daugiausia serijų; trumpesnis tiesiog turi tuščią ratą.',
  groupAs: (l: string) => `Grupuoti kaip ${l}`,
};

export const STRINGS: Record<LocaleId, SupersetsStrings> = { en, uk, pl, et, lt };
