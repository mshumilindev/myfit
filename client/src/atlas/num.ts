/**
 * Numbers as a person reads them — spans in days/weeks/months, one decimal at most,
 * never "-0", NaN or 1.235921712962963. Shared by the answers and the notes.
 */
import type { LocaleId } from '../i18n';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Ukrainian plural form: 1 день · 2 дні · 5 днів (also 21 день, 11 днів). */
export function ukForm(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (!Number.isInteger(a)) return few; // fractions: "2,5 дні" (callers pass whole numbers)
  const m10 = a % 10;
  const m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** English plural: 1 day · 2 days. */
export const enForm = (n: number, one: string, many: string): string =>
  Math.abs(n) === 1 ? one : many;

/** A finite number rounded to `digits` decimals, without "-0" (NaN/∞ → 0). */
export function round(n: number, digits = 0): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r; // -0 → 0
}

/**
 * A number with at most `digits` decimals, trailing zeros dropped; the decimal
 * mark follows the locale (uk writes "2,5").
 */
export function dec(n: number, locale: LocaleId | string, digits = 1): string {
  const s = String(round(n, digits));
  return locale === 'uk' ? s.replace('.', ',') : s;
}

/** A signed delta: "+3", "−2", "±0" (true minus, never "-0"). */
export function signed(n: number, locale: LocaleId | string = 'en', digits = 0): string {
  const r = round(n, digits);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${dec(Math.abs(r), locale, digits)}`;
}

/** Whole count + noun: "1 day" / "3 days"; uk "1 день" / "3 дні" / "5 днів". */
export function count(
  locale: LocaleId | string,
  n: number,
  en: [string, string],
  uk: [string, string, string],
): string {
  const v = round(n);
  return locale === 'uk'
    ? `${v} ${ukForm(v, uk[0], uk[1], uk[2])}`
    : `${v} ${enForm(v, en[0], en[1])}`;
}

export const days = (locale: LocaleId | string, n: number) =>
  count(locale, n, ['day', 'days'], ['день', 'дні', 'днів']);
export const weeks = (locale: LocaleId | string, n: number) =>
  count(locale, n, ['week', 'weeks'], ['тиждень', 'тижні', 'тижнів']);
export const sessions = (locale: LocaleId | string, n: number) =>
  count(locale, n, ['session', 'sessions'], ['тренування', 'тренування', 'тренувань']);
export const sets = (locale: LocaleId | string, n: number) =>
  count(locale, n, ['set', 'sets'], ['сет', 'сети', 'сетів']);

/*
 * Spans of time as a person says them. One table for every language:
 *   < 1 h          "under an hour"
 *   1–23 h         "5 hours" (whole hours, never "~30 h")
 *   1–13 days      whole days, to the nearest (30 h → 1 day, 44 h → 2 days)
 *   14–59 days     weeks, to the nearest; "about" when ≥ 2 days off (17 d → about 2 weeks)
 *   60 d – 11 mo   months (30.44 d); "about" when ≥ 8 days off (a quarter of a month)
 *   ≥ 12 months    years (+ months): "1 year and 4 months", same "about" rule
 * "yesterday" only from calendar days (daysAgo), never from a 24-hour span.
 */
const MONTH_DAYS = 30.44;
export type SpanUnit = 'hour' | 'day' | 'week' | 'month' | 'year';
export interface SpanParts {
  /** Under an hour. */
  under: boolean;
  about: boolean;
  n: number;
  unit: SpanUnit;
  /** Months after the years ("1 year and 4 months"). */
  months: number;
}

export function spanParts(ms: number): SpanParts {
  const base = { under: false, about: false, months: 0 };
  if (!Number.isFinite(ms) || ms < HOUR) return { ...base, under: true, n: 0, unit: 'hour' };
  const h = Math.round(ms / HOUR);
  if (h < 24) return { ...base, n: h, unit: 'hour' };
  const d = Math.max(1, Math.round(ms / DAY));
  if (d < 14) return { ...base, n: d, unit: 'day' };
  if (d < 60) {
    const w = Math.round(d / 7);
    return { ...base, about: Math.abs(d - w * 7) >= 2, n: w, unit: 'week' };
  }
  const m = Math.round(d / MONTH_DAYS);
  const about = Math.abs(d - m * MONTH_DAYS) >= 8;
  if (m < 12) return { ...base, about, n: m, unit: 'month' };
  return { ...base, about, n: Math.floor(m / 12), unit: 'year', months: m % 12 };
}

type Forms = Record<SpanUnit, string[]>;
interface SpanLang {
  /** Index of the noun form for a count. */
  form: (n: number) => number;
  /** Nouns after a number, as a duration / after "ago" (cases differ in uk, pl). */
  nom: Forms;
  acc: Forms;
  /** After "about" (uk, pl govern the genitive; others reuse acc). */
  about: string;
  aboutForms: Forms;
  and: string;
  under: string;
  underAgo: string;
  ago: (x: string) => string;
  today: string;
  yesterday: string;
}

/** Slavic 3-way (uk, pl, and the shape Lithuanian uses): one · few · many. */
const ukIdx = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 0;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
  return 2;
};
/** Polish: only exactly 1 takes the singular (21 dni, 22 dni, 25 dni). */
const plIdx = (n: number) => {
  if (n === 1) return 0;
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
};
/** Lithuanian: 1, 21 · 2–9, 22–29 · 10–20, 30 … */
const ltIdx = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 0;
  if (m10 >= 2 && (m100 < 12 || m100 > 19)) return 1;
  return 2;
};

const EN_FORMS: Forms = {
  hour: ['hour', 'hours'],
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
};
const UK_NOM: Forms = {
  hour: ['година', 'години', 'годин'],
  day: ['день', 'дні', 'днів'],
  week: ['тиждень', 'тижні', 'тижнів'],
  month: ['місяць', 'місяці', 'місяців'],
  year: ['рік', 'роки', 'років'],
};
const PL_NOM: Forms = {
  hour: ['godzina', 'godziny', 'godzin'],
  day: ['dzień', 'dni', 'dni'],
  week: ['tydzień', 'tygodnie', 'tygodni'],
  month: ['miesiąc', 'miesiące', 'miesięcy'],
  year: ['rok', 'lata', 'lat'],
};
const LT_ACC: Forms = {
  hour: ['valandą', 'valandas', 'valandų'],
  day: ['dieną', 'dienas', 'dienų'],
  week: ['savaitę', 'savaites', 'savaičių'],
  month: ['mėnesį', 'mėnesius', 'mėnesių'],
  year: ['metus', 'metus', 'metų'],
};
const ET_FORMS: Forms = {
  hour: ['tund', 'tundi'],
  day: ['päev', 'päeva'],
  week: ['nädal', 'nädalat'],
  month: ['kuu', 'kuud'],
  year: ['aasta', 'aastat'],
};

const LANGS: Record<'en' | 'uk' | 'pl' | 'lt' | 'et', SpanLang> = {
  en: {
    form: (n) => (n === 1 ? 0 : 1),
    nom: EN_FORMS,
    acc: EN_FORMS,
    about: 'about ',
    aboutForms: EN_FORMS,
    and: ' and ',
    under: 'under an hour',
    underAgo: 'under an hour ago',
    ago: (x) => `${x} ago`,
    today: 'today',
    yesterday: 'yesterday',
  },
  uk: {
    form: ukIdx,
    nom: UK_NOM,
    acc: { ...UK_NOM, hour: ['годину', 'години', 'годин'] },
    // "близько" + родовий: близько 2 тижнів, близько 1 року.
    about: 'близько ',
    aboutForms: {
      hour: ['години', 'годин', 'годин'],
      day: ['дня', 'днів', 'днів'],
      week: ['тижня', 'тижнів', 'тижнів'],
      month: ['місяця', 'місяців', 'місяців'],
      year: ['року', 'років', 'років'],
    },
    and: ' і ',
    under: 'менше години',
    underAgo: 'менше години тому',
    ago: (x) => `${x} тому`,
    today: 'сьогодні',
    yesterday: 'вчора',
  },
  pl: {
    form: plIdx,
    nom: PL_NOM,
    acc: { ...PL_NOM, hour: ['godzinę', 'godziny', 'godzin'] },
    // "mniej więcej" leaves the case alone: mniej więcej 3 tygodnie temu.
    about: 'mniej więcej ',
    aboutForms: { ...PL_NOM, hour: ['godzinę', 'godziny', 'godzin'] },
    and: ' i ',
    under: 'mniej niż godzina',
    underAgo: 'mniej niż godzinę temu',
    ago: (x) => `${x} temu`,
    today: 'dzisiaj',
    yesterday: 'wczoraj',
  },
  lt: {
    // Duration and "prieš" both take the accusative: 3 savaites, prieš 3 savaites.
    form: ltIdx,
    nom: LT_ACC,
    acc: LT_ACC,
    about: 'maždaug ',
    aboutForms: LT_ACC,
    and: ' ir ',
    under: 'mažiau nei valandą',
    underAgo: 'mažiau nei prieš valandą',
    ago: (x) => `prieš ${x}`,
    today: 'šiandien',
    yesterday: 'vakar',
  },
  et: {
    form: (n) => (n === 1 ? 0 : 1),
    nom: ET_FORMS,
    acc: ET_FORMS,
    about: 'umbes ',
    aboutForms: ET_FORMS,
    and: ' ja ',
    under: 'alla tunni',
    underAgo: 'vähem kui tund tagasi',
    ago: (x) => `${x} tagasi`,
    today: 'täna',
    yesterday: 'eile',
  },
};
const lang = (locale: LocaleId | string): SpanLang =>
  LANGS[(locale in LANGS ? locale : 'en') as keyof typeof LANGS];

function words(L: SpanLang, p: SpanParts, forms: Forms): string {
  const one = (n: number, u: SpanUnit) => `${n} ${forms[u][L.form(n)]}`;
  return p.unit === 'year' && p.months > 0
    ? `${one(p.n, 'year')}${L.and}${one(p.months, 'month')}`
    : one(p.n, p.unit);
}

function render(L: SpanLang, p: SpanParts, isAgo: boolean): string {
  if (p.under) return isAgo ? L.underAgo : L.under;
  const x = p.about ? `${L.about}${words(L, p, L.aboutForms)}` : words(L, p, isAgo ? L.acc : L.nom);
  return isAgo ? L.ago(x) : x;
}

/**
 * A duration, not "ago": "hasn't moved in 3 weeks", "5 days off", "a streak of
 * 2 months". uk "3 тижні", "близько 2 тижнів"; pl/lt/et in their own words.
 */
export function span(locale: LocaleId | string, ms: number): string {
  return render(lang(locale), spanParts(ms), false);
}

/** How long ago: "3 days ago", "about 2 weeks ago"; uk "3 дні тому"; pl "… temu"; lt "prieš …"; et "… tagasi". */
export function ago(locale: LocaleId | string, ms: number): string {
  return render(lang(locale), spanParts(ms), true);
}

/** By calendar day: 0 "today", 1 "yesterday", then as ago() ("3 days ago", "2 weeks ago"). */
export function daysAgo(locale: LocaleId | string, calendarDays: number): string {
  const L = lang(locale);
  const d = Math.max(0, round(calendarDays));
  if (d === 0) return L.today;
  if (d === 1) return L.yesterday;
  return ago(locale, d * DAY);
}

/** Whole days as a span: 3 → "3 days", 17 → "about 2 weeks", 90 → "3 months". */
export const spanDays = (locale: LocaleId | string, d: number) => span(locale, d * DAY);

/**
 * Through the context's formatters when they have them — translated chat
 * builds English with placeholders (⟦D:…⟧) that become Polish/Lithuanian/
 * Estonian words later; otherwise straight from the table above.
 */
interface SpanFmt {
  span?: (ms: number) => string;
  ago?: (ms: number) => string;
  daysAgo?: (days: number) => string;
}
export const spanOf = (c: { locale: LocaleId | string; fmt?: SpanFmt }, ms: number) =>
  c.fmt?.span ? c.fmt.span(ms) : span(c.locale, ms);
export const agoOf = (c: { locale: LocaleId | string; fmt?: SpanFmt }, ms: number) =>
  c.fmt?.ago ? c.fmt.ago(ms) : ago(c.locale, ms);
export const daysAgoOf = (c: { locale: LocaleId | string; fmt?: SpanFmt }, days: number) =>
  c.fmt?.daysAgo ? c.fmt.daysAgo(days) : daysAgo(c.locale, days);
/** Whole days as a span through the context: spanOf(c, d days). */
export const spanDaysOf = (c: { locale: LocaleId | string; fmt?: SpanFmt }, d: number) =>
  spanOf(c, d * DAY);

/** First letter up, for a span that opens a sentence ("About 3 weeks off."); placeholders pass through. */
export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The formatters a real (en/uk/pl/lt/et) Fmt carries. */
export const spanFmt = (locale: LocaleId | string): Required<SpanFmt> => ({
  span: (ms) => span(locale, ms),
  ago: (ms) => ago(locale, ms),
  daysAgo: (d) => daysAgo(locale, d),
});

/** Whole calendar days between two moments (local midnights): 23:00 → 01:00 is 1 day. */
export function calendarDays(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / DAY);
}

/** Thousands grouped with a narrow space: 12 480 (whole numbers). */
export function thousands(n: number): string {
  return String(round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** One set as text: "82.5 kg × 5"; a bodyweight set (no load) as "8 reps" / "8 повт." — never "0 kg × 8". */
export function setText(
  c: { locale: LocaleId | string; fmt: { kg: (n: number) => string } },
  kg: number | null | undefined,
  reps: number | null | undefined,
): string {
  if (reps == null) return kg && kg > 0 ? c.fmt.kg(kg) : '—';
  if (kg && kg > 0) return `${c.fmt.kg(kg)} × ${reps}`;
  return reps_(c.locale, reps);
}

/** "8 reps" / "8 повторів" (a full word: "повт." before a full stop reads "повт.."). */
function reps_(locale: LocaleId | string, n: number): string {
  return count(locale, n, ['rep', 'reps'], ['повтор', 'повтори', 'повторів']);
}
export { reps_ as reps };

/** Working sets with the adjective agreeing: "3 working sets"; uk "1 робочий сет", "3 робочі сети", "5 робочих сетів". */
export const workingSets = (locale: LocaleId | string, n: number) =>
  locale === 'uk'
    ? `${round(n)} ${ukForm(round(n), 'робочий сет', 'робочі сети', 'робочих сетів')}`
    : `${round(n)} ${enForm(round(n), 'working set', 'working sets')}`;

/** A set count that may be fractional (secondary work counts half): "4.5 sets", "1 set"; uk "4,5 сета", "3 сети". */
export function setsDec(locale: LocaleId | string, n: number): string {
  const r = round(n, 1);
  if (Number.isInteger(r)) return sets(locale, r);
  return `${dec(r, locale)} ${locale === 'uk' ? 'сета' : 'sets'}`;
}
