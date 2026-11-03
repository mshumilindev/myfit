/**
 * SPO-35 P17 — "which month was my best", "what was my best week": the busiest calendar month / Monday-start
 * week in the log, by sessions (ties → more working sets). Answers come from the log only.
 */
import { date, finishedOf, type AskCtx, type Parsed, type Tr } from './intentKit';
import * as N from './num';
import { setTypeOf } from '../store';

interface Bucket {
  start: number;
  sessions: number;
  sets: number;
}

function buckets(c: AskCtx, key: (t: number) => number): Bucket[] {
  const m = new Map<number, Bucket>();
  for (const w of finishedOf(c)) {
    const k = key(w.startedAt);
    const b = m.get(k) ?? { start: k, sessions: 0, sets: 0 };
    b.sessions += 1;
    b.sets += w.exercises.reduce(
      (n, e) => n + e.sets.filter((x) => setTypeOf(x) !== 'warmup').length,
      0,
    );
    m.set(k, b);
  }
  return [...m.values()];
}

const monthKey = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};
const weekKey = (t: number) => {
  const d = new Date(t);
  const back = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
};
const best = (bs: Bucket[]) =>
  bs.reduce<Bucket | null>(
    (a, b) =>
      !a || b.sessions > a.sessions || (b.sessions === a.sessions && b.sets > a.sets) ? b : a,
    null,
  );

/** en / uk spell the month; pl / lt / et stay numeric so the sentence frame translates. */
const monthLabel = (c: AskCtx, ts: number) =>
  c.locale === 'en' || c.locale === 'uk'
    ? new Intl.DateTimeFormat(c.locale, { month: 'long', year: 'numeric' }).format(new Date(ts))
    : new Intl.DateTimeFormat(c.locale, { month: '2-digit', year: 'numeric' }).format(new Date(ts));

const BEST_MONTH_RE =
  /(?<!\p{L})(which|what)( was| is)? (my |the )?(best|busiest|most active|biggest) month(?!\p{L})|(?<!\p{L})(which|what) month (was|is) (my )?(best|busiest|most active)(?!\p{L})|(?<!\p{L})(my )?busiest month(?!\p{L})|(?<!\p{L})(який|яка) (місяць|місяця) (був|був у мене) (найкращ\p{L}*|найактивніш\p{L}*)|(?<!\p{L})мій найактивніший місяць/iu;
const BEST_WEEK_RE =
  /(?<!\p{L})(which|what)( was| is)? (my |the )?(best|busiest|most active|biggest) week(?!\p{L})|(?<!\p{L})(which|what) week (was|is) (my )?(best|busiest|most active)(?!\p{L})|(?<!\p{L})(my )?busiest week(?!\p{L})|^\s*best week( ever)?\s*$|(?<!\p{L})(який|яка) (тиждень|тижня) (був|був у мене) (найкращ\p{L}*|найактивніш\p{L}*)|(?<!\p{L})мій найактивніший тиждень/iu;

/** The busiest calendar month / week in the log, or null when the question is not about that. */
export function bestPeriod(
  question: string,
  c: AskCtx,
  L: Tr,
): { intent: string; text: string } | null {
  const month = BEST_MONTH_RE.test(question);
  if (!month && !BEST_WEEK_RE.test(question)) return null;
  const b = best(buckets(c, month ? monthKey : weekKey));
  if (!b)
    return {
      intent: month ? 'best_month' : 'best_week',
      text: L('Nothing in your log yet.', 'У журналі ще нічого нема.'),
    };
  if (month) {
    const m = monthLabel(c, b.start);
    return {
      intent: 'best_month',
      text: L(
        `Your busiest month: ${m} — ${N.sessions('en', b.sessions)}, ${N.workingSets('en', b.sets)}.`,
        `Найактивніший місяць: ${m} — ${N.sessions('uk', b.sessions)}, ${N.workingSets('uk', b.sets)}.`,
      ),
    };
  }
  return {
    intent: 'best_week',
    text: L(
      `Your busiest week started ${date(c, b.start)} — ${N.sessions('en', b.sessions)}, ${N.workingSets('en', b.sets)}.`,
      `Найактивніший тиждень почався ${date(c, b.start)} — ${N.sessions('uk', b.sessions)}, ${N.workingSets('uk', b.sets)}.`,
    ),
  };
}

/** The `month` intent: this month, or the month named ("…in September"). */
export function monthAnswer(c: AskCtx, p: Parsed, L: Tr): string {
  const d = new Date(c.now);
  // "…in September" names a month: count that window, not just this month.
  const named = p.range && /^(in|since) /u.test(p.range.label[0]) ? p.range : null;
  const start = named?.from ?? new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = named?.to ?? Infinity;
  const f = finishedOf(c).filter((w) => w.startedAt >= start && w.startedAt < end);
  const sets = f.reduce(
    (a, w) =>
      a + w.exercises.flatMap((e) => e.sets.filter((s) => setTypeOf(s) !== 'warmup')).length,
    0,
  );
  const yr = (t: number) =>
    new Date(t).getFullYear() === d.getFullYear() ? '' : ` ${new Date(t).getFullYear()}`;
  const cap = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`;
  return L(
    `${named ? cap(named.label[0]) + yr(named.from) : 'This month'}: ${N.sessions('en', f.length)}, ${N.workingSets('en', sets)}.`,
    `${named ? cap(named.label[1]) + yr(named.from) : 'Цього місяця'}: ${N.sessions('uk', f.length)}, ${N.workingSets('uk', sets)}.`,
  );
}
