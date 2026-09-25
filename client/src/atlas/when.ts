/**
 * Time in questions: "last 3 months", "since June", "this week",
 * "за останні 2 тижні", "з червня", "минулого місяця", "3 months ago",
 * and weekdays ("move legs to Thursday", "перенеси на четвер").
 * Works on the normalized phrase (lowercase, no apostrophes).
 */
import type { Range } from './intentKit';

const DAY = 86_400_000;

// Month stems → month index (en, uk incl. cases, ru, pl, lt, et).
const MONTHS: [RegExp, number][] = [
  [
    /(?<!\p{L})(jan|january|січень|січня|січні|январ[ьяе]|styczeń|styczniu|stycznia|sausio|sausį|jaanuar\p{L}*)(?!\p{L})/u,
    0,
  ],
  [
    /(?<!\p{L})(feb|february|лютий|лютого|лютому|феврал[ьяе]|luty|lutego|lutym|vasario|vasarį|veebruar\p{L}*)(?!\p{L})/u,
    1,
  ],
  [
    /(?<!\p{L})(march|березень|березня|березні|март[ае]?|marzec|marca|marcu|kovo|kovą|märts\p{L}*)(?!\p{L})/u,
    2,
  ],
  [
    /(?<!\p{L})(apr|april|квітень|квітня|квітні|апрел[ьяе]|kwiecień|kwietnia|kwietniu|balandžio|balandį|aprill\p{L}*)(?!\p{L})/u,
    3,
  ],
  [/(?<!\p{L})(травень|травня|травні|мая|мае|maj|maja|maju|gegužės|gegužę)(?!\p{L})/u, 4],
  [
    /(?<!\p{L})(june|червень|червня|червні|июн[ьяе]|czerwiec|czerwca|czerwcu|birželio|birželį|juuni\p{L}*)(?!\p{L})/u,
    5,
  ],
  [
    /(?<!\p{L})(july|липень|липня|липні|июл[ьяе]|lipiec|lipca|lipcu|liepos|liepą|juuli\p{L}*)(?!\p{L})/u,
    6,
  ],
  [
    /(?<!\p{L})(aug|august|серпень|серпня|серпні|август[ае]?|sierpień|sierpnia|sierpniu|rugpjūčio|rugpjūtį|augustis?)(?!\p{L})/u,
    7,
  ],
  [
    /(?<!\p{L})(sept|september|вересень|вересня|вересні|сентябр[ьяе]|wrzesień|września|wrześniu|rugsėjo|rugsėjį|septembri?s?)(?!\p{L})/u,
    8,
  ],
  [
    /(?<!\p{L})(oct|october|жовтень|жовтня|жовтні|октябр[ьяе]|październik|października|październiku|spalio|spalį|oktoobri?s?)(?!\p{L})/u,
    9,
  ],
  [
    /(?<!\p{L})(nov|november|листопад|листопада|листопаді|ноябр[ьяе]|listopad|listopada|listopadzie|lapkričio|lapkritį|novembri?s?)(?!\p{L})/u,
    10,
  ],
  [
    /(?<!\p{L})(dec|december|грудень|грудня|грудні|декабр[ьяе]|grudzień|grudnia|grudniu|gruodžio|gruodį|detsembri?s?)(?!\p{L})/u,
    11,
  ],
];
// "May" only with a preposition in front (else it's "may I…").
const MAY_EN = /\b(in|since|from|during)\s+may\b/;

const UNIT: [RegExp, 'day' | 'week' | 'month' | 'year'][] = [
  [/^(day|days|дн\p{L}*|день|доб\p{L}*|dni|dzień|dien\p{L}*|päev\p{L}*)$/u, 'day'],
  [
    /^(week|weeks|тижн\p{L}*|тиждень|недел\p{L}*|tygodni\p{L}*|tydzień|savait\p{L}*|nädal\p{L}*)$/u,
    'week',
  ],
  [
    /^(month|months|місяц\p{L}*|місяць|месяц\p{L}*|miesi\p{L}*|mėnes\p{L}*|mėnuo|kuu|kuud|kuus\p{L}*)$/u,
    'month',
  ],
  [/^(year|years|рік|рок\p{L}*|років|год|года|лет|rok\p{L}*|lat|met\p{L}*|aasta\p{L}*)$/u, 'year'],
];
const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  twelve: 12,
  один: 1,
  одна: 1,
  два: 2,
  дві: 2,
  три: 3,
  чотири: 4,
  пять: 5,
  шість: 6,
  два_: 2,
  один_: 1,
  две: 2,
  четыре: 4,
  шесть: 6,
  jeden: 1,
  dwa: 2,
  trzy: 3,
  cztery: 4,
  vienas: 1,
  du: 2,
  trys: 3,
  üks: 1,
  kaks: 2,
  kolm: 3,
  couple: 2,
  пару: 2,
  кілька: 3,
  few: 3,
};

const LAST =
  /(?<!\p{L})(last|past|previous|останн\p{L}*|последн\p{L}*|ostatni\p{L}*|paskutin\p{L}*|viimas\p{L}*)(?!\p{L})/u;
const AGO = /(?<!\p{L})(ago|тому|назад|temu|prieš|tagasi)(?!\p{L})/u;
const SINCE = /(?<!\p{L})(since|from|з|із|зі|с|od|nuo|alates)(?!\p{L})/u;

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const monthStart = (y: number, m: number) => new Date(y, m, 1).getTime();
const unitMs = (u: 'day' | 'week' | 'month' | 'year') =>
  u === 'day' ? DAY : u === 'week' ? 7 * DAY : u === 'month' ? 30.44 * DAY : 365.25 * DAY;
const unitName = (u: 'day' | 'week' | 'month' | 'year', n: number): [string, string] => {
  const en = { day: 'day', week: 'week', month: 'month', year: 'year' }[u] + (n === 1 ? '' : 's');
  const uk =
    u === 'day'
      ? n === 1
        ? 'день'
        : n < 5
          ? 'дні'
          : 'днів'
      : u === 'week'
        ? n === 1
          ? 'тиждень'
          : n < 5
            ? 'тижні'
            : 'тижнів'
        : u === 'month'
          ? n === 1
            ? 'місяць'
            : n < 5
              ? 'місяці'
              : 'місяців'
          : n === 1
            ? 'рік'
            : n < 5
              ? 'роки'
              : 'років';
  return [en, uk];
};
const EN_MONTH = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const UK_MONTH_GEN = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];
const UK_MONTH_LOC = [
  'січні',
  'лютому',
  'березні',
  'квітні',
  'травні',
  'червні',
  'липні',
  'серпні',
  'вересні',
  'жовтні',
  'листопаді',
  'грудні',
];

/** Find a time window in a normalized phrase, or null. */
export function parseRange(phrase: string, now: number): Range | null {
  // Fixed expressions first.
  if (
    /(^|\s)(fortnight|two weeks|дві тижні|двох тижнів|два тижні|две недели|двух недель)(\s|$)/u.test(
      phrase,
    )
  )
    return { from: now - 14 * DAY, to: now, label: ['the last 2 weeks', 'останні 2 тижні'] };
  if (
    /(new year|start of (the )?year|beginning of (the )?year|нового року|початку року|нового года|начала года)/u.test(
      phrase,
    )
  ) {
    const from = new Date(new Date(now).getFullYear(), 0, 1).getTime();
    return { from, to: now, label: ['since New Year', 'з початку року'] };
  }
  const words = phrase.split(' ');
  // "N units" (with last / ago).
  for (let i = 0; i < words.length; i++) {
    const u = UNIT.find(([re]) => re.test(words[i]))?.[1];
    if (!u) continue;
    const prev = words[i - 1] ?? '';
    const n = /^\d+$/.test(prev)
      ? Number(prev)
      : (WORD_NUM[prev] ?? (LAST.test(phrase) || AGO.test(phrase) ? 1 : 0));
    if (!n || n > 120) continue;
    const ago = AGO.test(phrase);
    const hasLast = LAST.test(phrase);
    const hasNumber = /^\d+$/.test(prev) || WORD_NUM[prev] !== undefined;
    // "last week" / "минулого тижня" (calendar) vs "last 3 weeks" (rolling).
    if (!hasNumber && !ago) {
      const cal = calendar(phrase, u, now);
      if (cal) return cal;
      if (!hasLast) continue;
    }
    const span = n * unitMs(u);
    const name = unitName(u, n);
    if (ago)
      return {
        from: now - span,
        to: now,
        ago: true,
        label: [`${n} ${name[0]} ago`, `${n} ${name[1]} тому`],
      };
    return {
      from: now - span,
      to: now,
      label:
        n === 1
          ? [`the last ${name[0]}`, `останній ${name[1]}`]
          : [`the last ${n} ${name[0]}`, `останні ${n} ${name[1]}`],
    };
  }
  for (const u of ['week', 'month', 'year'] as const) {
    const cal = calendar(phrase, u, now);
    if (cal) return cal;
  }
  // Months: "since June", "in August", "з червня", "у серпні".
  const m: [RegExp, number] | undefined =
    MONTHS.find(([re]) => re.test(phrase)) ?? (MAY_EN.test(phrase) ? [/\bmay\b/, 4] : undefined);
  if (m) {
    const month = m[1];
    const nowD = new Date(now);
    const year = month > nowD.getMonth() ? nowD.getFullYear() - 1 : nowD.getFullYear();
    const from = monthStart(year, month);
    const idx = phrase.search(m[0]);
    const before = phrase.slice(0, Math.max(0, idx)).trim().split(' ').pop() ?? '';
    if (SINCE.test(before) || /^(since|from|od|nuo|alates)$/.test(before))
      return { from, to: now, label: [`since ${EN_MONTH[month]}`, `з ${UK_MONTH_GEN[month]}`] };
    return {
      from,
      to: Math.min(now, monthStart(year, month + 1)),
      label: [`in ${EN_MONTH[month]}`, `у ${UK_MONTH_LOC[month]}`],
    };
  }
  return null;
}

/** "this/last week|month|year" and their translations. */
function calendar(phrase: string, u: 'day' | 'week' | 'month' | 'year', now: number): Range | null {
  const THIS =
    /(?<!\p{L})(this|current|цього|цей|цю|поточн\p{L}*|этот|этом|этой|этого|w tym|ten|ši|šį|šią|šio|see|sel|selle)(?!\p{L})/u;
  const PREV =
    /(?<!\p{L})(last|previous|минул\p{L}*|попередн\p{L}*|прошл\p{L}*|zeszł\p{L}*|poprzedni\p{L}*|praėjus\p{L}*|eelmis\p{L}*|möödunud)(?!\p{L})/u;
  const UNIT_RE: Record<string, RegExp> = {
    week: /(?<!\p{L})(week|тижн\p{L}*|тиждень|недел\p{L}*|tygodni\p{L}*|tydzień|savait\p{L}*|nädal\p{L}*)(?!\p{L})/u,
    month:
      /(?<!\p{L})(month|місяц\p{L}*|місяць|месяц\p{L}*|miesi\p{L}*|mėnes\p{L}*|mėnuo|kuu|kuus)(?!\p{L})/u,
    year: /(?<!\p{L})(year|рік|року|рок\p{L}*|году|год|roku|rok|metų|metai|aasta\p{L}*)(?!\p{L})/u,
  };
  if (u === 'day' || !UNIT_RE[u].test(phrase)) return null;
  const d = new Date(now);
  let from: number;
  if (u === 'week') {
    const dow = (d.getDay() + 6) % 7;
    from = startOfDay(now) - dow * DAY;
  } else if (u === 'month') from = monthStart(d.getFullYear(), d.getMonth());
  else from = new Date(d.getFullYear(), 0, 1).getTime();
  const names = {
    week: [
      ['this week', 'цього тижня'],
      ['last week', 'минулого тижня'],
    ],
    month: [
      ['this month', 'цього місяця'],
      ['last month', 'минулого місяця'],
    ],
    year: [
      ['this year', 'цього року'],
      ['last year', 'минулого року'],
    ],
  }[u] as [string, string][];
  if (PREV.test(phrase) && !/\d/.test(phrase)) {
    const prevFrom =
      u === 'week'
        ? from - 7 * DAY
        : u === 'month'
          ? monthStart(d.getFullYear(), d.getMonth() - 1)
          : new Date(d.getFullYear() - 1, 0, 1).getTime();
    return { from: prevFrom, to: from, label: names[1] };
  }
  if (THIS.test(phrase)) return { from, to: now, label: names[0] };
  return null;
}

// ---- weekdays -------------------------------------------------------------------

const WEEKDAYS: [RegExp, number][] = [
  [/^(sun(day)?|неділ\p{L}*|воскресень\p{L}*|niedziel\p{L}*|sekmadien\p{L}*|pühapäev\p{L}*)$/u, 0],
  [
    /^(mon(day)?|понеділ\p{L}*|понедельник\p{L}*|poniedział\p{L}*|pirmadien\p{L}*|esmaspäev\p{L}*)$/u,
    1,
  ],
  [/^(tue(s(day)?)?|вівтор\p{L}*|вторник\p{L}*|wtor\p{L}*|antradien\p{L}*|teisipäev\p{L}*)$/u, 2],
  [
    /^(wed(nesday)?|серед\p{L}*|сред\p{L}*|środ\p{L}*|srod\p{L}*|trečiadien\p{L}*|kolmapäev\p{L}*)$/u,
    3,
  ],
  [
    /^(thu(rs(day)?)?|четвер\p{L}*|четверг\p{L}*|czwart\p{L}*|ketvirtadien\p{L}*|neljapäev\p{L}*)$/u,
    4,
  ],
  [
    /^(fri(day)?|пятниц\p{L}*|пʼятниц\p{L}*|piąt\p{L}*|piat\p{L}*|penktadien\p{L}*|reede\p{L}*)$/u,
    5,
  ],
  [/^(sat(urday)?|субот\p{L}*|суббот\p{L}*|sobot\p{L}*|šeštadien\p{L}*|laupäev\p{L}*)$/u, 6],
];

/** Weekdays in the order they are named. */
export function parseWeekdays(words: string[]): number[] {
  const out: number[] = [];
  for (const w of words) {
    const d = WEEKDAYS.find(([re]) => re.test(w))?.[1];
    if (d !== undefined && !out.includes(d)) out.push(d);
  }
  return out;
}
