/**
 * SPO-35 P10 — data questions the long conversations found: "since when do I train", "when was my last
 * rest day", "how many days since my last workout", "did I train legs this month". Answers come from the
 * log only; the KB examples (`P10_EX`) are what let them beat the advice topics (rest_day, skip, month).
 */
import { DAY, date, finishedOf, type AskCtx, type Intent } from './intentKit';
import * as N from './num';
import { muscleSetsInWorkout } from '../store';

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** The latest calendar day (before today) with no finished session, looking back at most 60 days. */
function lastRestDay(c: AskCtx): number | null {
  const trained = new Set(finishedOf(c).map((w) => dayKey(w.startedAt)));
  const today = dayKey(c.now);
  for (let i = 1; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (!trained.has(d.getTime())) return d.getTime();
  }
  return null;
}

const noLog = (L: Parameters<Intent['answer']>[2]) =>
  L('Nothing in your log yet.', 'У журналі ще нічого нема.');

interface Topic {
  id: string;
  keys: string[][];
  needs?: Intent['needs'];
  answer: Intent['answer'];
  ex: string[];
  exUk: string[];
}

const TOPICS: Topic[] = [
  {
    id: 'since_start',
    keys: [
      ['since when', 'how long have', 'відколи', 'скільки часу'],
      ['train', 'training', 'lifting', 'gym', 'тренуюс*', 'качаюс*', 'займаюс*'],
    ],
    answer: (c, _p, L) => {
      const ws = finishedOf(c);
      if (!ws.length) return noLog(L);
      const first = ws[ws.length - 1].startedAt;
      const days = Math.max(0, Math.round((c.now - first) / DAY));
      const weeks = Math.max(1, Math.round(days / 7));
      const perWeek = Math.round((ws.length / weeks) * 10) / 10;
      return L(
        `Your log starts ${date(c, first)} (${N.daysAgoOf(c, days)}): ${N.sessions('en', ws.length)}, about ${perWeek} a week.`,
        `Журнал починається ${date(c, first)} (${N.daysAgoOf(c, days)}): ${N.sessions('uk', ws.length)}, приблизно ${perWeek} на тиждень.`,
      );
    },
    ex: ['how long have i been training', 'since when do i train', 'when did i start training'],
    exUk: ['відколи я тренуюся', 'скільки часу я займаюся', 'коли я почав тренуватися'],
  },
  {
    id: 'last_rest_day',
    keys: [
      ['rest day', 'day off', 'вихідний', 'день відпочинку'],
      ['when', 'last', 'коли', 'останній', 'востаннє'],
    ],
    answer: (c, _p, L) => {
      if (!finishedOf(c).length) return noLog(L);
      const d = lastRestDay(c);
      if (d === null)
        return L(
          'No day without a session in the last 60 days. Plan a rest day.',
          'За останні 60 днів нема дня без тренування. Заплануй вихідний.',
        );
      const days = Math.round((dayKey(c.now) - d) / DAY);
      return L(
        `Your last day without a session was ${N.daysAgoOf(c, days)} (${date(c, d)}).`,
        `Останній день без тренування був ${N.daysAgoOf(c, days)} (${date(c, d)}).`,
      );
    },
    ex: [
      'when was my last rest day',
      'when did i last take a day off',
      'when was the last time i rested',
      'when was my last day off',
    ],
    exUk: [
      'коли в мене був останній вихідний',
      'коли я востаннє відпочивав від тренувань',
      'коли був мій останній день відпочинку',
    ],
  },
  {
    id: 'days_since_workout',
    keys: [
      ['days since', 'how many days', 'how long since', 'скільки днів'],
      [
        'last workout',
        'last session',
        'last training',
        'останнього тренування',
        'останнє тренування',
      ],
    ],
    answer: (c, _p, L) => {
      const ws = finishedOf(c);
      if (!ws.length) return noLog(L);
      const days = Math.round((dayKey(c.now) - dayKey(ws[0].startedAt)) / DAY);
      return L(
        `Last session: ${N.daysAgoOf(c, days)} (${date(c, ws[0].startedAt)}).`,
        `Останнє тренування: ${N.daysAgoOf(c, days)} (${date(c, ws[0].startedAt)}).`,
      );
    },
    ex: [
      'how many days since my last workout',
      'how long since my last session',
      'days since i last trained',
    ],
    exUk: [
      'скільки днів минуло від останнього тренування',
      'скільки днів минуло з мого останнього тренування',
      'відколи я востаннє тренувався',
    ],
  },
  {
    id: 'muscle_in_range',
    keys: [
      ['did i', 'чи я', 'чи тренував', 'чи качав'],
      ['train', 'hit', 'тренував*', 'качав*'],
    ],
    needs: 'range',
    answer: (c, p, L) => {
      if (!p.muscle || p.exercise || !p.range) return null;
      // "this week" is covered (and contracted) by muscle_last / week; the longer windows had no answer.
      if (p.range.label[0] === 'this week') return null;
      const r = p.range;
      const m = c.fmt.muscle(p.muscle);
      const ws = finishedOf(c).filter((w) => w.startedAt >= r.from && w.startedAt < r.to);
      const hits = ws.filter((w) => (muscleSetsInWorkout(w).get(p.muscle!) ?? 0) > 0);
      const sets = Math.round(
        hits.reduce((n, w) => n + (muscleSetsInWorkout(w).get(p.muscle!) ?? 0), 0),
      );
      return hits.length
        ? L(
            `Yes — ${m}, ${r.label[0]}: ${N.sessions('en', hits.length)}, ${N.sets('en', sets)}.`,
            `Так — ${m}, ${r.label[1]}: ${N.sessions('uk', hits.length)}, ${N.sets('uk', sets)}.`,
          )
        : L(`No — nothing for ${m}, ${r.label[0]}.`, `Ні — ${m}, ${r.label[1]}: у журналі нічого.`);
    },
    ex: ['did i train legs in march', 'did i train back in august'],
    exUk: [
      'чи тренував я ноги вчора',
      'чи качав я груди в понеділок',
      'чи тренував я ноги у березні',
    ],
  },
];

export const INTENTS_P10: Intent[] = TOPICS.map((t) => ({
  id: t.id,
  all: t.keys,
  needs: t.needs,
  neutral: true,
  answer: t.answer,
}));

export const P10_EX: Record<string, { ex: string[]; exUk: string[] }> = Object.fromEntries(
  TOPICS.map((t) => [t.id, { ex: t.ex, exUk: t.exUk }]),
);
