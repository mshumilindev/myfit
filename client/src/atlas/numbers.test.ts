/**
 * Guard: no answer or note ever prints raw machine numbers — "1.235921712962963 d",
 * "NaN", "Infinity", "undefined", "-0" and the like. Runs every intent's
 * canonical ask, the knowledge-base phrasings and every intent handler directly
 * over several histories (empty, beginner, long, bodyweight-only, with a plan),
 * plus the notes feed.
 */
import { describe, expect, it } from 'vitest';
import type { Exercise, Injury, SleepNight, Workout } from '../types';
import { answerLocally, ALL_INTENTS, type AskCtx } from './intents';
import type { Intent, Parsed } from './intentKit';
import { ASKS } from './asks';
import { buildNotes } from './notes';
import { proposePlan } from './plan';
import { computePlaybook } from '../playbook';
import { COACH_DEFAULT, TEMPERS } from './types';
import type { Fmt } from './voice';
import { fmtBodyWeightKg } from '../i18n';
import { fmtCountdown } from '../restTimer';
import { richCtx } from './testCtx';
import * as N from './num';
import { e1rm } from './liftStats';
import { calcAnswer } from './calc';
import { isWeekEnd, weekFact } from './facts';
import { blockWeek } from './plan';
import { muscleReadiness } from '../recovery';

const DAY = 86_400_000;
// A Wednesday evening, deliberately not on a round hour.
const NOW = new Date(2026, 8, 23, 18, 37, 11).getTime();

/** Deterministic pseudo-random (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let n = 0;
const lift = (name: string, weight: number | null, reps: number[]): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: reps.map((r, i) => ({
      id: `s${n++}`,
      reps: r,
      weight,
      isWarmup: false,
      position: i,
      restSec: 60 + ((i * 37) % 120),
      loggedAt: null,
    })),
  }) as unknown as Exercise;

const session = (at: number, exs: Exercise[], minutes = 63.4): Workout =>
  ({
    id: `W${n++}`,
    startedAt: at,
    finishedAt: at + minutes * 60_000,
    autoFinished: false,
    gymId: 'g1',
    exercises: exs,
  }) as unknown as Workout;

const BARBELL: [string, number][] = [
  ['Barbell Bench Press - Medium Grip', 82.5],
  ['Barbell Full Squat', 107.5],
  ['Barbell Deadlift', 142.5],
  ['Standing Military Press', 47.5],
  ['Bent Over Barbell Row', 67.5],
  ['Barbell Curl', 32.5],
  ['Dumbbell Flyes', 16.25],
  ['Leg Press', 183.33],
  ['Pullups', 0],
];

/** Sessions going back `span` days, every ~`gap` days, odd hours and weights. */
function history(seed: number, count: number, gap: number, grow = 0.004): Workout[] {
  const r = rng(seed);
  const out: Workout[] = [];
  for (let i = 0; i < count; i++) {
    // The latest session ~1.24 days ago — the owner's bug case.
    const at = NOW - (1.235921712962963 + i * gap + r() * 0.9) * DAY;
    const k = count - i;
    const exs = BARBELL.filter((_, j) => (j + i) % 3 !== 0).map(([nm, w]) =>
      lift(nm, w === 0 ? null : w * (1 + grow * k) - (i % 4) * 1.25, [8, 7 + (i % 3), 6 + (i % 2)]),
    );
    out.push(session(at, exs, 40 + r() * 50));
  }
  return out;
}

// The app's own formatters (useAtlasFmt) — numbers that bypass them are the bugs.
const fmt: Fmt = {
  kg: (k) => fmtBodyWeightKg(k),
  mmss: (s) => fmtCountdown(s),
  muscle: (m) => m,
  exercise: (e) => e,
};

const weights = (count: number, start: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    at: NOW - (i * 6.3 + 0.37) * DAY,
    weight: start - i * 0.137,
  }));

const sleeps = (count: number): SleepNight[] =>
  Array.from({ length: count }, (_, i) => {
    const wake = NOW - (i + 0.4) * DAY;
    const d = new Date(wake);
    return {
      id: `sl${i}`,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      bedtime: wake - (5.3 + (i % 4) * 0.77) * 3_600_000,
      wake,
      source: 'manual',
    } as unknown as SleepNight;
  });

const injury = {
  id: 'inj1',
  reason: 'injury',
  bodyPart: 'shoulder',
  side: 'left',
  muscles: ['shoulders'],
  stage: 'reintroduce',
  startDay: Math.floor((NOW - 9.6 * DAY) / DAY),
  createdAt: NOW - 9.6 * DAY,
  history: [],
} as unknown as Injury;

function ctx(
  locale: 'en' | 'uk',
  workouts: Workout[],
  extra: Partial<AskCtx['s']> = {},
  now = NOW,
): AskCtx {
  return {
    s: {
      workouts,
      coach: { ...COACH_DEFAULT, enabled: true, startedAt: now - 40 * DAY },
      injuries: [],
      sleeps: [],
      bodyMetrics: { weights: [] },
      restPeriods: [],
      exerciseRest: {},
      activities: [],
      gyms: [{ id: 'g1', name: 'Northside Gym' } as never],
      goals: {},
      ...extra,
    } as AskCtx['s'],
    now,
    locale,
    temper: 3,
    fmt,
  };
}

const LONG = history(7, 150, 2.37);
const BEGINNER = history(3, 3, 3.1, 0);
const SINGLE = [
  session(NOW - 1.2359 * DAY, [lift('Barbell Bench Press - Medium Grip', 61.25, [5, 5, 4])]),
];
const BODYWEIGHT = Array.from({ length: 12 }, (_, i) =>
  session(NOW - (1.2359 + i * 2.9) * DAY, [
    lift('Pullups', null, [8, 7, 6]),
    lift('Pushups', null, [20, 18, 15]),
    lift('Bodyweight Squat', null, [25, 25, 20]),
  ]),
);
const withPlan = (): AskCtx['s']['coach'] => ({
  ...COACH_DEFAULT,
  enabled: true,
  role: 'main',
  startedAt: NOW - 40 * DAY,
  plan: proposePlan({
    finished: LONG,
    plays: computePlaybook(LONG, NOW).plays,
    now: NOW - 9.3 * DAY,
  }),
});

type Named = [string, (l: 'en' | 'uk') => AskCtx];
const CONTEXTS: Named[] = [
  ['empty', (l) => ctx(l, [])],
  ['beginner', (l) => ctx(l, BEGINNER, { bodyMetrics: { weights: weights(2, 81.35) } })],
  [
    'long',
    (l) =>
      ctx(l, LONG, {
        bodyMetrics: { weights: weights(40, 92.3) },
        sleeps: sleeps(20),
        injuries: [injury],
      }),
  ],
  ['bodyweight', (l) => ctx(l, BODYWEIGHT)],
  ['single', (l) => ctx(l, SINGLE, { bodyMetrics: { weights: weights(1, 70.05) } })],
  [
    'plan',
    (l) => ({
      ...ctx(l, LONG, { bodyMetrics: { weights: weights(10, 77.77) }, sleeps: sleeps(5) }),
      s: {
        ...ctx(l, LONG).s,
        coach: withPlan(),
        bodyMetrics: { weights: weights(10, 77.77) },
      },
    }),
  ],
  ['rich', (l) => richCtx(l)],
  // Back after ~7 weeks off: every "since" / "ago" / "hasn't moved in" is long.
  [
    'gap',
    (l) =>
      ctx(
        l,
        LONG.map((w) => ({
          ...w,
          startedAt: w.startedAt - 47.6 * DAY,
          finishedAt: (w.finishedAt ?? w.startedAt) - 47.6 * DAY,
        })),
        {
          bodyMetrics: { weights: weights(40, 92.3).map((x) => ({ ...x, at: x.at - 47.6 * DAY })) },
        },
      ),
  ],
];

// Anything a person should never read in an answer. We never group thousands
// with "." (en uses "," or a space, uk a space), so "1.235" is always a raw
// fraction; with "," only 4+ digits are surely one ("1,250 kg" is fine).
const BAD: [string, RegExp][] = [
  ['3+ decimals', /\d\.\d{3,}|\d,\d{4,}/u],
  ['NaN', /\bNaN\b/],
  ['Infinity', /Infinity/],
  ['undefined', /\bundefined\b/],
  ['null', /\bnull\b/],
  ['-0', /(^|[^\d.,])[-−]0(?![\d.,])|[-−]0[.,]0+(?!\d*[1-9])/u],
  ['[object', /\[object/],
  // Plurals: "1 days", "1 тренувань", "3 днів".
  [
    'plural',
    /(?<![\d.,])1 (days|weeks|sessions|sets|times|workouts|months|hours|reps)\b|(?<![\d.,])(1|21|31) (днів|дні|тижнів|тижні|сетів|сети|тренувань|разів|місяців|годин|повторів)(?![\p{L}])|(?<![\d.,])(?<!(?:близько| і) )[234] (днів|тижнів|сетів|разів|місяців|годин|повторів)(?![\p{L}])/u,
  ],
];

// Spans as a person says them (num.span / num.ago): no "44 h" past a day, no
// "20 days" past two weeks, no "12 weeks" past two months. Advice ranges
// ("for 6–12 weeks", "8–12 тижнів") are how a coach says them and pass.
const TOO_BIG: [string, RegExp, number][] = [
  ['hours past a day', /(?<![\d.,–-])(\d+) ?(?:h|год)(?![\p{L}])/gu, 23],
  [
    'days past two weeks',
    /(?<![\d.,–-])(\d{2,}) (?:days?|дн(?:і|ів|я)|дн\.|день)(?![\p{L}])/gu,
    13,
  ],
  [
    'weeks past two months',
    /(?<![\d.,–-])(\d{2,}) (?:weeks?|тиж(?:ні|нів|день|\.))(?![\p{L}])/gu,
    8,
  ],
];

function problems(text: string | null | undefined): string[] {
  if (!text) return [];
  // Dates ("23.09.2026", "9/23/2026") are not fractions.
  const t = text.replace(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g, 'DATE');
  return [
    ...BAD.filter(([, re]) => re.test(t)).map(([name]) => name),
    ...TOO_BIG.filter(([, re, max]) => [...t.matchAll(re)].some((m) => Number(m[1]) > max)).map(
      ([name]) => name,
    ),
  ];
}

/** The canonical ask of every topic, plus numbers-heavy questions. */
function questions(locale: 'en' | 'uk'): string[] {
  const qs = new Set<string>();
  for (const [en, uk] of Object.values(ASKS)) qs.add(locale === 'uk' ? uk : en);
  for (const [en, uk] of NUMBER_QS) qs.add(locale === 'uk' ? uk : en);
  return [...qs];
}

const NUMBER_QS: [string, string][] = [
  ['how many workouts in the last 3 months', 'скільки тренувань за останні 3 місяці'],
  ['what did I do last month', 'що я робив минулого місяця'],
  ['total volume last week', 'скільки тонн я підняв минулого тижня'],
  ['how is my bench since June', 'як мій жим з червня'],
  ['am I stronger than 3 months ago', 'чи я сильніший ніж 3 місяці тому'],
  ['my bodyweight over the last 2 months', 'моя вага за останні 2 місяці'],
  ['chest sets in the last month', 'сети на груди за останній місяць'],
  ['bench vs squat', 'жим проти присіду'],
  ['why today', 'чому сьогодні це'],
  ['why this weight', 'чому така вага'],
  ['when did I last train back', 'коли я востаннє тренував спину'],
  ['how many days since my last workout', 'скільки днів з останнього тренування'],
  ['average session length this month', 'середня тривалість тренування цього місяця'],
  [
    'average sets per session last month',
    'скільки в середньому сетів за тренування минулого місяця',
  ],
  ['heaviest squat ever', 'найважчий присід'],
  ['how many reps can I do with 80 kg on bench', 'скільки повторів я зроблю з 80 кг у жимі'],
  ['1rm if I do 100 x 5', '1пм якщо 100 на 5'],
  ['80% of 117.5', '80% від 117,5'],
  ['will I bench 100x10 if now 0x8', 'пожму 100 на 10 якщо зараз 0 на 8'],
  ['what is 5 minus 5', 'скільки буде 5 мінус 5'],
  ['how many pullups did I do this week', 'скільки підтягувань цього тижня'],
];

const at = (label: string, q: string, text: string, bad: string[]) =>
  `${label} :: ${q} → ${bad.join(', ')} :: ${text}`;

describe('Atlas never prints raw numbers', () => {
  // answerLocally is ~0.1 s a question (retrieval), so the full ask list runs
  // over a spread of histories/locales rather than every pair.
  const RUNS: [string, 'en' | 'uk'][] = [
    ['long', 'en'],
    ['long', 'uk'],
    ['plan', 'uk'],
    ['beginner', 'en'],
    ['bodyweight', 'en'],
    ['empty', 'uk'],
    ['single', 'uk'],
    ['gap', 'en'],
  ];
  for (const [name, locale] of RUNS)
    it(`answers (${name}, ${locale})`, { timeout: 120_000 }, () => {
      const c = CONTEXTS.find(([n]) => n === name)![1](locale);
      const fails: string[] = [];
      for (const q of questions(locale)) {
        const text = answerLocally(q, c)?.text ?? '';
        const bad = problems(text);
        if (bad.length) fails.push(at(name, q, text, bad));
      }
      expect(fails).toEqual([]);
    });

  for (const [name, make] of CONTEXTS)
    for (const locale of ['en', 'uk'] as const)
      it(`every intent handler (${name}, ${locale})`, { timeout: 120_000 }, () => {
        const c = make(locale);
        const L = (en: string, uk: string) => (locale === 'uk' ? uk : en);
        const bench = 'Barbell Bench Press - Medium Grip';
        const squat = 'Barbell Full Squat';
        const variants: Parsed[] = [
          { words: [], phrase: '', exercise: null, muscle: null },
          {
            words: ['bench'],
            phrase: 'bench',
            exercise: bench,
            muscle: 'chest',
            exercises: [bench, squat],
            range: { from: NOW - 90 * DAY, to: NOW, label: ['last 3 months', 'останні 3 місяці'] },
            weekdays: [4],
          },
          {
            words: ['squat'],
            phrase: 'squat 3 months ago',
            exercise: 'Pullups',
            muscle: 'lats',
            exercises: ['Pullups', squat],
            range: {
              from: NOW - 91 * DAY,
              to: NOW - 90 * DAY,
              label: ['3 months ago', '3 місяці тому'],
              ago: true,
            },
          },
        ];
        const fails: string[] = [];
        // Like the router: an intent only runs with what it needs in the question.
        const hasNeeds = (it: Intent, p: Parsed) =>
          !it.needs ||
          (it.needs === 'exercise' && !!p.exercise) ||
          (it.needs === 'muscle' && !!p.muscle) ||
          (it.needs === 'range' && !!p.range) ||
          (it.needs === 'twoLifts' && (p.exercises?.length ?? 0) >= 2);
        for (const it of ALL_INTENTS())
          for (const p of variants.filter((v) => hasNeeds(it, v))) {
            const outs: [string, string | null | undefined][] = [];
            const run = (k: string, f: () => string | null | undefined) => {
              try {
                outs.push([k, f()]);
              } catch (e) {
                fails.push(`${name} :: ${it.id}.${k} threw ${(e as Error).message}`);
              }
            };
            run('answer', () => it.answer(c, p, L));
            if (it.why) run('why', () => it.why!(c, p, L));
            if (it.more) for (let d = 0; d < 3; d++) run(`more${d}`, () => it.more!(c, p, L, d));
            if (it.chart) run('chart', () => it.chart!(c, p, L)?.title);
            for (const [k, text] of outs) {
              const bad = problems(text);
              if (bad.length) fails.push(at(name, `${it.id}.${k}[${p.phrase}]`, text ?? '', bad));
            }
          }
        expect(fails).toEqual([]);
      });

  it('notes feed', { timeout: 120_000 }, () => {
    const fails: string[] = [];
    for (const [name, make] of CONTEXTS)
      for (const locale of ['en', 'uk'] as const)
        // Every day of a week, so Sunday's week summary is covered too.
        for (let d = 0; d < 7; d++) {
          const c = make(locale);
          const now = c.now + d * DAY;
          for (const temper of TEMPERS) {
            const res = buildNotes(
              { ...c.s, coach: { ...c.s.coach, temper, startedAt: now - 30 * DAY } },
              now,
              locale,
              fmt,
            );
            for (const note of res.notes) {
              const bad = problems(note.text);
              if (bad.length) fails.push(at(`${name}/${temper}/d${d}`, note.kind, note.text, bad));
            }
          }
        }
    expect(fails).toEqual([]);
  });

  it('a comeback after ~6 weeks off reads in weeks, in every language', () => {
    const before = LONG.slice(1).map((w) => ({
      ...w,
      startedAt: w.startedAt - 42 * DAY,
      finishedAt: (w.finishedAt ?? w.startedAt) - 42 * DAY,
    }));
    const texts = (['en', 'uk', 'pl', 'lt', 'et'] as const).map((locale) => {
      const c = ctx('en', [LONG[0], ...before]);
      const res = buildNotes(
        { ...c.s, coach: { ...c.s.coach, temper: 3, startedAt: NOW - 30 * DAY } },
        NOW,
        locale,
        fmt,
      );
      return res.notes.find((x) => x.kind === 'comeback')?.text ?? '';
    });
    // 42 + ~2.4–3.3 days between the sessions → 44–45 days → "about 6 weeks".
    expect(texts).toEqual([
      expect.stringContaining('About 6 weeks off'),
      expect.stringContaining('Близько 6 тижнів перерви'),
      expect.stringContaining('Mniej więcej 6 tygodni przerwy'),
      expect.stringContaining('Maždaug 6 savaites be treniruočių'),
      expect.stringContaining('Umbes 6 nädalat vahet'),
    ]);
    for (const t of texts.slice(0, 2)) expect(problems(t)).toEqual([]);
  });
});

// ---- the formulas fixed alongside the guard (expected values worked by hand) ----

const byId = (id: string) => ALL_INTENTS().find((x) => x.id === id)!;
const EN_L = (en: string) => en;
const UK_L = (_en: string, uk: string) => uk;
const P0: Parsed = { words: [], phrase: '', exercise: null, muscle: null };

describe('number wording', () => {
  it('plural forms (en / uk)', () => {
    expect([1, 2, 5, 11, 21, 22, 112].map((k) => N.days('uk', k))).toEqual([
      '1 день',
      '2 дні',
      '5 днів',
      '11 днів',
      '21 день',
      '22 дні',
      '112 днів',
    ]);
    expect(N.days('en', 1)).toBe('1 day');
    expect(N.sessions('en', 0)).toBe('0 sessions');
    expect(N.sessions('uk', 3)).toBe('3 тренування');
    expect(N.workingSets('uk', 54)).toBe('54 робочі сети');
    expect(N.setsDec('en', 4.5)).toBe('4.5 sets');
    expect(N.setsDec('uk', 4.5)).toBe('4,5 сета');
  });

  it('rest spans: hours under a day, whole days after (full table in span.test.ts)', () => {
    // The owner's numbers: 1.235921712962963 d = 29.66 h → 1 day; 4.349 d → 4 days.
    expect(N.ago('en', 1.235921712962963 * DAY)).toBe('1 day ago');
    expect(N.ago('uk', 1.235921712962963 * DAY)).toBe('1 день тому');
    expect(N.ago('en', 4.34912380787037 * DAY)).toBe('4 days ago');
    expect(N.ago('uk', 4.34912380787037 * DAY)).toBe('4 дні тому');
    expect(N.ago('en', 20 * 60_000)).toBe('under an hour ago');
    expect(N.span('en', 44 * 3_600_000)).toBe('2 days');
  });

  it('the span guard itself', () => {
    expect(problems('last trained 44 h ago')).toContain('hours past a day');
    expect(problems('~30 год тому')).toContain('hours past a day');
    expect(problems('7.5 h of sleep, 23 h ago')).toEqual([]);
    expect(problems('hasn’t moved in 20 days')).toContain('days past two weeks');
    expect(problems('13 days ago, 25 днів тому')).toEqual(['days past two weeks']);
    expect(problems('12 weeks')).toContain('weeks past two months');
    expect(problems('Week 12 of 12, 8 weeks')).toEqual([]);
  });

  it('signs and decimals: true minus, no "-0", locale decimal mark', () => {
    expect(N.signed(-0)).toBe('±0');
    expect(N.signed(-0.04, 'en', 1)).toBe('±0');
    expect(N.signed(-2.345, 'en', 1)).toBe('−2.3');
    expect(N.signed(2.5, 'uk', 1)).toBe('+2,5');
    expect(N.dec(2 / 3, 'en')).toBe('0.7');
    expect(N.dec(NaN, 'en')).toBe('0');
    expect(N.thousands(12480)).toBe('12 480');
  });

  it('calendar days, not 24-hour blocks', () => {
    const y20 = new Date(2026, 8, 22, 20).getTime();
    const t18 = new Date(2026, 8, 23, 18).getTime();
    expect(N.calendarDays(y20, t18)).toBe(1); // 22 h apart, but yesterday
    expect(N.calendarDays(t18 - 3_600_000, t18)).toBe(0);
  });
});

describe('estimated max (Epley)', () => {
  it('a single is the max; reps above the formula count as 10', () => {
    expect(e1rm(100, 1)).toBe(100); // not 103
    expect(e1rm(100, 5)).toBe(117); // 100 × (1 + 5/30) = 116.7
    expect(e1rm(60, 12)).toBe(80); // 60 × (1 + 10/30); was 0 → the raw 60 stood in
    expect(e1rm(0, 8)).toBe(0);
  });

  it('reps at a weight inverts it, at least 1 at the max', () => {
    const bench = 'Barbell Bench Press - Medium Grip';
    const c = ctx('en', [session(NOW - 2 * DAY, [lift(bench, 100, [5])])]);
    const intent = byId('reps_at_weight');
    const p = (kg: number): Parsed => ({ ...P0, phrase: `bench ${kg} kg`, exercise: bench });
    // e1 = 117: at 100 kg → 30 × (117/100 − 1) = 5.1 → 5 reps; at 117 kg → 1 rep.
    expect(intent.answer(c, p(100), EN_L)).toContain('about 5 reps');
    expect(intent.answer(c, p(117), EN_L)).toContain('about 1 rep ');
    expect(intent.answer(c, p(120), EN_L)).toContain('above your estimated max');
  });

  it('two sets compared from an empty bar: no Infinity%', () => {
    const t = calcAnswer('will I bench 100x10 if now 0x8', EN_L, (k) => `${k} kg`) ?? '';
    expect(t).toContain('133 kg'); // 100 × (1 + 10/30)
    expect(t).not.toMatch(/Infinity|NaN/);
  });
});

describe('counts that used to be off', () => {
  it('a week counts working sets, not the per-muscle tally', () => {
    // One session, 3 bench sets: chest + triceps + shoulders tallied it as 6.
    const c = ctx('en', [
      session(NOW - 1.2 * DAY, [lift('Barbell Bench Press - Medium Grip', 80, [8, 8, 8])]),
    ]);
    expect(byId('week').answer(c, P0, EN_L)).toBe(
      'Last 7 days: 1 session (usual 1), 3 working sets.',
    );
  });

  it('this week follows the configured first day', () => {
    // Wed 23 Sep 2026. Monday start: this week = Mon 21…; Sunday start: Sun 20….
    const sun20 = session(new Date(2026, 8, 20, 10).getTime(), [lift('Barbell Curl', 30, [10])]);
    const tue22 = session(new Date(2026, 8, 22, 10).getTime(), [lift('Barbell Curl', 30, [10])]);
    expect(weekFact([sun20, tue22], NOW, 3, 1)).toMatchObject({ sessions: 1, planned: 3 });
    expect(weekFact([sun20, tue22], NOW, 3, 7)).toMatchObject({ sessions: 2, planned: 3 });
    // The review comes on the week's last day: Sunday (Monday start), Saturday (Sunday start).
    expect(isWeekEnd(new Date(2026, 8, 27, 12).getTime(), 1)).toBe(true);
    expect(isWeekEnd(new Date(2026, 8, 26, 12).getTime(), 7)).toBe(true);
    expect(isWeekEnd(new Date(2026, 8, 27, 12).getTime(), 7)).toBe(false);
  });

  it('block week: 1-based, by calendar days, never below 1', () => {
    const start = new Date(2026, 8, 21).getTime();
    const plan = { blockStart: start, weeks: 6 } as never;
    expect(blockWeek(plan, new Date(2026, 8, 27, 23).getTime())).toBe(1);
    expect(blockWeek(plan, new Date(2026, 8, 28, 0, 30).getTime())).toBe(2);
    expect(blockWeek(plan, start - DAY)).toBe(1);
  });
});

describe('why_today (the owner’s report)', () => {
  // Lats + traps ~29.7 h ago, lower back ~4.35 days ago, core not trained.
  const w1 = session(NOW - 1.235921712962963 * DAY, [
    lift('Pullups', null, [8, 8, 7]),
    lift('Barbell Shrug', 100, [12, 12, 12]),
  ]);
  const w2 = session(NOW - 4.34912380787037 * DAY, [
    lift('Hyperextensions (Back Extensions)', 20, [12, 12, 12]),
  ]);
  const today = new Date(NOW).getDay();
  const day = (weekday: number) => ({
    weekday,
    split: 'pull',
    muscles: ['lats', 'traps', 'core', 'lower_back'],
    name: null,
  });
  const planWith = (weekday: number) =>
    ({
      createdAt: NOW - 10 * DAY,
      blockStart: NOW - 10 * DAY,
      weeks: 6,
      days: [day(weekday)],
      lengthMin: 60,
      intent: 'muscle',
      warmup: true,
      cardio: false,
      cooldown: false,
    }) as never;
  const make = (l: 'en' | 'uk', weekday = today): AskCtx => {
    const c = ctx(l, [w1, w2]);
    return {
      ...c,
      s: {
        ...c.s,
        coach: { ...COACH_DEFAULT, enabled: true, role: 'main', plan: planWith(weekday) },
      },
    };
  };

  it('human rest times, and only recovered muscles under “Recovered”', () => {
    const t = byId('why_today').answer(make('en'), P0, EN_L)!;
    expect(t).not.toMatch(/\d\.\d{3,}/);
    expect(t).toContain('lats (1 day ago');
    expect(t).toContain('lower_back (last trained 4 days ago)');
    expect(t).toContain('core (not trained in 2+ weeks)');
    // Lats: a 2.5-day window — at ~1.24 days it is NOT recovered.
    const [rec, cooling = ''] = t.split('Still recovering:');
    expect(rec).not.toContain('lats');
    expect(cooling).toContain('lats');
    const ready = muscleReadiness([w1, w2], NOW);
    for (const m of ['lats', 'traps', 'lower_back'] as const) {
      const r = ready.get(m)!;
      expect(rec.includes(m)).toBe(r.state === 'ready' || r.state === 'stale');
    }
  });

  it('Ukrainian: hours and days with the right forms', () => {
    const t = byId('why_today').answer(make('uk'), P0, UK_L)!;
    expect(t).toContain('lats (1 день тому');
    expect(t).toContain('lower_back (востаннє 4 дні тому)');
  });

  it('a plan with nothing today is a rest day', () => {
    const t = byId('why_today').answer(make('en', (today + 1) % 7), P0, EN_L);
    expect(t).toMatch(/rest day/);
  });
});
